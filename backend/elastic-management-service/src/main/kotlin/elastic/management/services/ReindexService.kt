package dk.sdu.cloud.elastic.management.services

import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.service.Loggable
import io.ktor.http.HttpStatusCode
import org.elasticsearch.ElasticsearchStatusException
import org.elasticsearch.client.RequestOptions
import org.elasticsearch.client.RestClient
import org.elasticsearch.client.RestHighLevelClient
import org.elasticsearch.common.unit.TimeValue
import org.elasticsearch.index.reindex.ReindexRequest
import org.slf4j.Logger
import java.io.IOException
import java.time.LocalDate

class ReindexService(
    private val elastic: RestHighLevelClient
) {

    fun reindexSpecificIndices(fromIndices: List<String>, toIndices: List<String>, lowLevelClient: RestClient) {
        println("reindexing")
        if (fromIndices.isEmpty() || fromIndices.size != toIndices.size) {
            throw RPCException.fromStatusCode(HttpStatusCode.BadRequest, "From cannot be empty or sizes are not equal.")
        }
        fromIndices.forEachIndexed { index, fromIndex ->
            val toIndex = toIndices[index]
            log.info("Reindexing: $fromIndex to $toIndex")
            if (!indexExists(toIndex, elastic)) {
                createIndex(toIndex, elastic)
            }

            val request = ReindexRequest()

            request.setSourceIndices(fromIndex)
            request.setDestIndex(toIndex)
            request.setSourceBatchSize(2500)
            request.setTimeout(TimeValue.timeValueMinutes(2))

            try {
                elastic.reindex(request, RequestOptions.DEFAULT)
            } catch (ex: Exception) {
                when (ex) {
                    is IOException -> {
                        //Did not finish reindexing in 2 min (timeout)
                        val fromCount = getDocumentCountSum(listOf(fromIndex), lowLevelClient)
                        var toCount = getDocumentCountSum(listOf(toIndex), lowLevelClient)
                        while (fromCount != toCount) {
                            log.info("Waiting for target index to reach count: $fromCount. Currently doc count is: $toCount")
                            Thread.sleep(10000)
                            toCount = getDocumentCountSum(listOf(toIndex), lowLevelClient)
                        }
                    }
                    is ElasticsearchStatusException -> {
                        //This is most likely due to API changes resulting in not same mapping for entire week
                        if (ex.message == "Unable to parse response body") {
                            log.info("status exception")
                            log.info(ex.toString())
                        }
                        else {
                            throw ex
                        }
                    }
                    else -> {
                        log.warn("not known exception")
                        throw ex
                    }
                }
            }
            //Delete old indices
            deleteIndex(fromIndex, elastic)
        }
    }

    fun reindex(fromIndices: List<String>, toIndex: String, lowLevelClient: RestClient) {
        //Should always be lowercase
        val destinationIndex = toIndex.toLowerCase()

        if (fromIndices.isEmpty()) {
            //Nothing to reindex
            return
        }

        var error = false
        fromIndices.forEach {
            if (!indexExists(it, elastic)) {
                log.warn("Index: $it, does not exist. Check spelling and that all is lowercase.")
                error = true
            }
        }
        if (error) {
            log.info("Quiting due to missing indices in request")
            throw IllegalArgumentException()
        }

        if (!indexExists(destinationIndex, elastic)) {
            createIndex(destinationIndex, elastic)
        }

        val request = ReindexRequest()

        request.setSourceIndices(*fromIndices.toTypedArray())
        request.setDestIndex(destinationIndex)
        request.setSourceBatchSize(2500)
        request.setTimeout(TimeValue.timeValueMinutes(2))

        try {
            elastic.reindex(request, RequestOptions.DEFAULT)
        } catch (ex: Exception) {
            when (ex) {
                is IOException -> {
                    //Did not finish reindexing in 2 min (timeout)
                    val fromCount = getDocumentCountSum(fromIndices, lowLevelClient)
                    var toCount = getDocumentCountSum(listOf(toIndex), lowLevelClient)
                    while (fromCount != toCount) {
                        log.info("Waiting for target index to reach count: $fromCount. Currently doc count is: $toCount")
                        Thread.sleep(10000)
                        toCount = getDocumentCountSum(listOf(toIndex), lowLevelClient)
                    }
                }
                is ElasticsearchStatusException -> {
                    //This is most likely due to API changes resulting in not same mapping for entire week
                    if (ex.message == "Unable to parse response body") {
                        log.info("status exception")
                        log.info(ex.toString())
                    }
                    else {
                        throw ex
                    }
                }
                else -> {
                    log.warn("not known exception")
                    throw ex
                }
            }
        }
        //Delete old indices
        fromIndices.forEach {
            deleteIndex(it, elastic)
        }
    }

    fun reindexLogsWithPrefixAWeekBackFrom(
        daysInPast: Long,
        prefix: String,
        lowLevelClient: RestClient,
        delimiter: String = "-"
    ) {
        getAllLogNamesWithPrefix(elastic, prefix, delimiter).forEach {
            val fromIndices = mutableListOf<String>()

            for (i in 0..6) {
                val index = it +
                        delimiter +
                        LocalDate.now().minusDays(daysInPast + i).toString().replace("-", ".") +
                        "_*"
                if (indexExists(index, elastic)) {
                    fromIndices.add(index)
                }
            }
            val toIndex = it +
                    delimiter +
                    LocalDate.now().minusDays(daysInPast + 6).toString().replace("-", ".") +
                    "-" +
                    LocalDate.now().minusDays(daysInPast).toString().replace("-", ".")

            //if no entries in last week no need to generate an empty index.
            if (fromIndices.isEmpty()) {
                log.info("No entries in last week. Won't create a weekly index for $toIndex")
                return@forEach
            }

            reindex(fromIndices, toIndex, lowLevelClient)
        }

    }

    fun reduceLastMonth(
        prefix: String,
        delimiter: String = "-",
        lowLevelClient: RestClient
    ) {
        val lastDayOfLastMonth = LocalDate.now().withDayOfMonth(1).minusDays(1)
        val numberOfDaysInLastMonth = lastDayOfLastMonth.dayOfMonth
        getAllLogNamesWithPrefix(elastic, prefix, delimiter).forEach {
            val fromIndices = mutableListOf<String>()
            for (i in 1..numberOfDaysInLastMonth) {
                val index = it + delimiter + lastDayOfLastMonth.withDayOfMonth(i).toString().replace("-", ".") + "*"
                if (indexExists(index, elastic)) {
                    fromIndices.add(index)
                }
            }
            val toIndex = it +
                    delimiter +
                    "monthly" +
                    delimiter +
                    lastDayOfLastMonth.withDayOfMonth(1).toString().replace("-", ".") +
                    "-" +
                    lastDayOfLastMonth.withDayOfMonth(numberOfDaysInLastMonth).toString().replace("-", ".")

            //if no entries in last month no need to generate an empty index.
            if (fromIndices.isEmpty()) {
                log.info("No entries in last month. Won't create a monthly index")
                return@forEach
            }

            reindex(fromIndices, toIndex, lowLevelClient)
        }
    }

    fun reduceLastQuarter(
        prefix: String,
        delimiter: String = "-",
        lowLevelClient: RestClient
    ) {
        val currentDate = LocalDate.now()
        getAllLogNamesWithPrefix(elastic, prefix).forEach {
            val fromIndices = mutableListOf<String>()
            for (i in 1..3) {
                val date = currentDate.minusMonths(i.toLong())
                val index = it +
                        delimiter +
                        "monthly" +
                        delimiter +
                        date.withDayOfMonth(1).toString().replace("-",".") +
                        "*"
                if (indexExists(index, elastic)) {
                    fromIndices.add(index)
                }
            }
            val toIndex = it +
                    delimiter +
                    "quarter" +
                    delimiter +
                    currentDate.withDayOfMonth(1).minusMonths(3).toString().replace("-",".") +
                    delimiter +
                    currentDate.withDayOfMonth(1).minusDays(1).toString().replace("-",".")
            reindex(fromIndices, toIndex, lowLevelClient)
        }
    }

    companion object : Loggable {
        override val log: Logger = ExpiredEntriesDeleteService.logger()
    }
}
