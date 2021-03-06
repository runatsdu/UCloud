package dk.sdu.cloud.indexing.services

import com.fasterxml.jackson.module.kotlin.readValue
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.defaultMapper
import dk.sdu.cloud.file.api.StorageFile
import dk.sdu.cloud.file.api.joinPath
import dk.sdu.cloud.indexing.api.AnyOf
import dk.sdu.cloud.indexing.api.Comparison
import dk.sdu.cloud.indexing.api.ComparisonOperator
import dk.sdu.cloud.indexing.api.FileQuery
import dk.sdu.cloud.indexing.api.NumericStatistics
import dk.sdu.cloud.indexing.api.NumericStatisticsRequest
import dk.sdu.cloud.indexing.api.PredicateCollection
import dk.sdu.cloud.indexing.api.SortDirection
import dk.sdu.cloud.indexing.api.SortRequest
import dk.sdu.cloud.indexing.api.SortableField
import dk.sdu.cloud.indexing.api.StatisticsRequest
import dk.sdu.cloud.indexing.api.StatisticsResponse
import dk.sdu.cloud.indexing.util.search
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.service.NormalizedPaginationRequest
import dk.sdu.cloud.service.Page
import io.ktor.http.HttpStatusCode
import mbuhot.eskotlin.query.compound.bool
import mbuhot.eskotlin.query.fulltext.match_phrase_prefix
import mbuhot.eskotlin.query.term.range
import mbuhot.eskotlin.query.term.terms
import org.elasticsearch.action.get.GetRequest
import org.elasticsearch.action.search.SearchRequest
import org.elasticsearch.client.RequestOptions
import org.elasticsearch.client.RestHighLevelClient
import org.elasticsearch.index.query.QueryBuilder
import org.elasticsearch.search.aggregations.AggregationBuilders
import org.elasticsearch.search.aggregations.Aggregations
import org.elasticsearch.search.aggregations.metrics.Avg
import org.elasticsearch.search.aggregations.metrics.Max
import org.elasticsearch.search.aggregations.metrics.Min
import org.elasticsearch.search.aggregations.metrics.Percentiles
import org.elasticsearch.search.aggregations.metrics.Sum
import org.elasticsearch.search.aggregations.metrics.ValueCount
import org.elasticsearch.search.builder.SearchSourceBuilder
import org.elasticsearch.search.sort.SortOrder

class ElasticQueryService(
    private val elasticClient: RestHighLevelClient,
    private val fastDirectoryStats: FastDirectoryStats?,
    private val cephFsRoot: String
) {
    private val mapper = defaultMapper

    fun query(
        query: FileQuery,
        paging: NormalizedPaginationRequest? = null,
        sorting: SortRequest? = null
    ): Page<ElasticIndexedFile> {
        if (paging != null && (paging.page * paging.itemsPerPage + paging.itemsPerPage) > 10000) {
            throw RPCException.fromStatusCode(HttpStatusCode.NotFound)
        }
        return elasticClient.search<ElasticIndexedFile>(mapper, paging, FILES_INDEX) {
            if (sorting != null) {
                val field = when (sorting.field) {
                    SortableField.FILE_NAME -> ElasticIndexedFile.FILE_NAME_KEYWORD
                    SortableField.FILE_TYPE -> ElasticIndexedFile.FILE_TYPE_FIELD
                    SortableField.SIZE -> ElasticIndexedFile.SIZE_FIELD
                }

                val direction = when (sorting.direction) {
                    SortDirection.ASCENDING -> SortOrder.ASC
                    SortDirection.DESCENDING -> SortOrder.DESC
                }

                sort(field, direction)

            }
            if (paging != null) {
                if (paging.page * paging.itemsPerPage + paging.itemsPerPage <= 10000) {
                    from(paging.page * paging.itemsPerPage)
                    size(paging.itemsPerPage)
                } else {
                    size(10000)
                }
            } else {
                //If pagination is not given then limit to 10000 results. If more needed use scroll API.
                size(10000)
            }
            searchBasedOnQuery(query).also {
                log.info(it.toString())
            }
        }
    }

    fun calculateSize(paths: Set<String>): Long {
        return if (fastDirectoryStats != null) {
            var sum = 0L
            for (path in paths) {
                sum += fastDirectoryStats.getRecursiveSize(joinPath(cephFsRoot, path))
            }
            sum
        } else {
            statisticsQuery(
                StatisticsRequest(
                    FileQuery(paths.toList()),
                    size = NumericStatisticsRequest(calculateSum = true)
                )
            ).size!!.sum!!.toLong()
        }
    }

    private fun searchBasedOnQuery(fileQuery: FileQuery): QueryBuilder {
        return with(fileQuery) {
            bool {
                should = ArrayList<QueryBuilder>().apply {
                    fileNameQuery?.forEach { q ->
                        if (!q.isBlank()) {
                            add(match_phrase_prefix {
                                ElasticIndexedFile.FILE_NAME_FIELD to {
                                    this.query = q
                                    max_expansions = FILE_NAME_QUERY_MAX_EXPANSIONS
                                }
                            })
                        }
                    }
                }

                filter = ArrayList<QueryBuilder>().also { list ->
                    val filteredRoots = roots.asSequence().filter { it != "/" }.map { it.removeSuffix("/") }.toList()
                    if (filteredRoots.isNotEmpty()) {
                        list.add(terms { ElasticIndexedFile.PATH_FIELD to filteredRoots })
                    }

                    fileNameExact.addClausesIfExists(list, ElasticIndexedFile.FILE_NAME_FIELD)
                    extensions.addClausesIfExists(list, ElasticIndexedFile.FILE_NAME_EXTENSION)
                    fileTypes.addClausesIfExists(list, ElasticIndexedFile.FILE_TYPE_FIELD)
                    fileDepth.addClausesIfExists(list, ElasticIndexedFile.FILE_DEPTH_FIELD)
                    size.addClausesIfExists(list, ElasticIndexedFile.SIZE_FIELD)
                }
            }.also {
                if (it.should().isNotEmpty()) {
                    it.minimumShouldMatch(1)
                }
            }
        }
    }

    private inline fun <reified P : Any> PredicateCollection<P>?.addClausesIfExists(
        list: MutableList<QueryBuilder>,
        fieldName: String
    ) {
        this?.let { list.addAll(it.convertToQuery(fieldName)) }
    }

    private inline fun <reified P : Any> PredicateCollection<P>.convertToQuery(fieldName: String): List<QueryBuilder> {
        val isComparison = P::class == Comparison::class

        return allOf.map {
            if (!isComparison) {
                it.toQuery(fieldName)
            } else {
                @Suppress("UNCHECKED_CAST")
                it as AnyOf<Comparison<*>>

                it.toComparisonQuery(fieldName)
            }
        }
    }

    private fun <P : Any> AnyOf<P>.toQuery(fieldName: String): QueryBuilder {
        val termsQuery = terms { fieldName to anyOf }

        return if (negate) {
            bool {
                must_not = listOf(termsQuery)
            }
        } else {
            termsQuery
        }
    }

    private fun <P : Comparison<*>> AnyOf<P>.toComparisonQuery(fieldName: String): QueryBuilder {
        val equalsTerm = anyOf.find { it.operator == ComparisonOperator.EQUALS }

        val query = if (equalsTerm != null) {
            terms {
                fieldName to listOf(equalsTerm.value)
            }
        } else {
            range {
                fieldName to {
                    anyOf.forEach {
                        when (it.operator) {
                            ComparisonOperator.GREATER_THAN -> gt = it.value
                            ComparisonOperator.GREATER_THAN_EQUALS -> gte = it.value
                            ComparisonOperator.LESS_THAN -> lt = it.value
                            ComparisonOperator.LESS_THAN_EQUALS -> lte = it.value
                            ComparisonOperator.EQUALS -> throw IllegalStateException("Assertion error")
                        }
                    }
                }
            }
        }

        return if (negate) {
            bool {
                must_not = listOf(query)
            }
        } else {
            query
        }
    }

    fun statisticsQuery(statisticsRequest: StatisticsRequest): StatisticsResponse {
        val result = elasticClient.search(FILES_INDEX) {
            source(SearchSourceBuilder().also { builder ->
                builder.size(0)
                builder.query(searchBasedOnQuery(statisticsRequest.query))

                builder.aggregation(
                    AggregationBuilders.count("completeCount").field(ElasticIndexedFile.FILE_NAME_KEYWORD)
                )

                statisticsRequest.size?.let {
                    addNumericAggregations(builder, it, ElasticIndexedFile.SIZE_FIELD)
                }

                statisticsRequest.fileDepth?.let {
                    addNumericAggregations(builder, it, ElasticIndexedFile.FILE_DEPTH_FIELD)
                }
            })
        }

        val size = statisticsRequest.size?.let {
            retrieveNumericAggregate(result.aggregations, it, ElasticIndexedFile.SIZE_FIELD)
        }

        val fileDepth = statisticsRequest.fileDepth?.let {
            retrieveNumericAggregate(result.aggregations, it, ElasticIndexedFile.FILE_DEPTH_FIELD)
        }

        return StatisticsResponse(
            runCatching { result.aggregations.get<ValueCount>("completeCount").value }.getOrDefault(0L),
            size,
            fileDepth
        )
    }

    private enum class NumericStat(val variableName: String) {
        MEAN("Mean"),
        MINIMUM("Minimum"),
        MAXIMUM("Maximum"),
        SUM("Sum"),
        PERCENTILES("Percentiles");

        fun computeVariableName(fieldName: String): String {
            return fieldName + variableName
        }
    }

    private fun addNumericAggregations(
        builder: SearchSourceBuilder,
        numericStatisticsRequest: NumericStatisticsRequest,
        fieldName: String
    ) {
        with(builder) {
            if (numericStatisticsRequest.calculateMean) {
                val variableName = NumericStat.MEAN.computeVariableName(fieldName)
                aggregation(
                    AggregationBuilders.avg(variableName).field(fieldName)
                )
            }

            if (numericStatisticsRequest.calculateMinimum) {
                val variableName = NumericStat.MINIMUM.computeVariableName(fieldName)
                aggregation(
                    AggregationBuilders.min(variableName).field(fieldName)
                )
            }

            if (numericStatisticsRequest.calculateMaximum) {
                val variableName = NumericStat.MAXIMUM.computeVariableName(fieldName)
                aggregation(
                    AggregationBuilders.max(variableName).field(fieldName)
                )
            }

            if (numericStatisticsRequest.calculateSum) {
                val variableName = NumericStat.SUM.computeVariableName(fieldName)
                aggregation(
                    AggregationBuilders.sum(variableName).field(fieldName)
                )
            }

            if (numericStatisticsRequest.percentiles.isNotEmpty()) {
                val variableName = NumericStat.PERCENTILES.computeVariableName(fieldName)

                @Suppress("SpreadOperator")
                aggregation(
                    AggregationBuilders
                        .percentiles(variableName)
                        .field(fieldName)
                        .percentiles(*numericStatisticsRequest.percentiles.toDoubleArray())
                )
            }
        }
    }

    private fun retrieveNumericAggregate(
        aggregations: Aggregations,
        numericStatisticsRequest: NumericStatisticsRequest,
        fieldName: String
    ): NumericStatistics {
        val mean = if (numericStatisticsRequest.calculateMean) {
            val variableName = NumericStat.MEAN.computeVariableName(fieldName)
            aggregations.get<Avg>(variableName)!!.value
        } else null

        val min = if (numericStatisticsRequest.calculateMinimum) {
            val variableName = NumericStat.MINIMUM.computeVariableName(fieldName)
            aggregations.get<Min>(variableName)!!.value
        } else null

        val max = if (numericStatisticsRequest.calculateMaximum) {
            val variableName = NumericStat.MAXIMUM.computeVariableName(fieldName)
            aggregations.get<Max>(variableName)!!.value
        } else null

        val sum = if (numericStatisticsRequest.calculateSum) {
            val variableName = NumericStat.SUM.computeVariableName(fieldName)
            aggregations.get<Sum>(variableName)!!.value
        } else null

        val percentiles = if (numericStatisticsRequest.percentiles.isNotEmpty()) {
            val variableName = NumericStat.PERCENTILES.computeVariableName(fieldName)
            val aggregation = aggregations.get<Percentiles>(variableName)!!
            numericStatisticsRequest.percentiles.map { aggregation.percentile(it) }
        } else emptyList()

        return NumericStatistics(
            mean = mean,
            minimum = min,
            maximum = max,
            sum = sum,
            percentiles = percentiles
        )
    }

    companion object : Loggable {
        override val log = logger()

        private const val FILES_INDEX = FileSystemScanner.FILES_INDEX

        private const val FILE_NAME_QUERY_MAX_EXPANSIONS = 10
    }
}
