package dk.sdu.cloud.app.store.services

import com.vladmihalcea.hibernate.type.array.StringArrayType
import dk.sdu.cloud.app.store.api.*
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.service.NormalizedPaginationRequest
import dk.sdu.cloud.service.Page
import dk.sdu.cloud.service.db.*
import dk.sdu.cloud.service.mapItems
import io.ktor.http.HttpStatusCode
import org.hibernate.jpa.TypedParameterValue
import java.math.BigInteger
import java.util.*

@Suppress("TooManyFunctions") // Does not make sense to split
class ApplicationHibernateDAO(
    private val toolDAO: ToolHibernateDAO
) : ApplicationDAO<HibernateSession> {
    private val byNameAndVersionCache = Collections.synchronizedMap(HashMap<NameAndVersion, Pair<Application, Long>>())

    override fun toggleFavorite(
        session: HibernateSession,
        user: String,
        name: String,
        version: String
    ) {
        val foundApp = internalByNameAndVersion(session, name, version) ?: throw ApplicationException.BadApplication()

        val isFavorite = session.typedQuery<Long>(
            """
                select count (A.applicationName)
                from FavoriteApplicationEntity as A
                where A.user = :user
                    and A.applicationName = :name
                    and A.applicationVersion= :version
            """.trimIndent()
        ).setParameter("user", user)
            .setParameter("name", name)
            .setParameter("version", version)
            .uniqueResult()

        if (isFavorite != 0L) {
            val query = session.createQuery(
                """
                delete from FavoriteApplicationEntity as A
                where A.user = :user
                    and A.applicationName = :name
                    and A.applicationVersion = :version
                """.trimIndent()
            ).setParameter("user", user)
                .setParameter("name", name)
                .setParameter("version", version)

            query.executeUpdate()
        } else {
            session.save(
                FavoriteApplicationEntity(
                    foundApp.id.name,
                    foundApp.id.version,
                    user
                )
            )
        }
    }

    override fun retrieveFavorites(
        session: HibernateSession,
        user: String,
        paging: NormalizedPaginationRequest
    ): Page<ApplicationSummaryWithFavorite> {
        val itemsInTotal = session.createCriteriaBuilder<Long, FavoriteApplicationEntity>().run {
            criteria.where(entity[FavoriteApplicationEntity::user] equal user)
            criteria.select(count(entity))
        }.createQuery(session).uniqueResult()

        val items = session.typedQuery<ApplicationEntity>(
            """
                select application
                from FavoriteApplicationEntity as fav, ApplicationEntity as application
                where
                    fav.user = :user and
                    fav.applicationName = application.id.name and
                    fav.applicationVersion = application.id.version
                order by fav.applicationName
            """.trimIndent()
        ).setParameter("user", user)
            .paginatedList(paging)
            .asSequence()
            .map { it.toModel() }
            .map { ApplicationSummaryWithFavorite(it.metadata, true) }
            .toList()

        return Page(
            itemsInTotal.toInt(),
            paging.itemsPerPage,
            paging.page,
            items
        )
    }

    override fun searchTags(
        session: HibernateSession,
        user: String,
        tags: List<String>,
        paging: NormalizedPaginationRequest
    ): Page<ApplicationSummaryWithFavorite> {
        val itemsInTotal = session
            .createNativeQuery(
                // language=sql
                """
                select count(*)
                from {h-schema}applications a
                where
                  jsonb_exists_any(tags, :tags) and
                  a.created_at in (
                    select max(created_at)
                    from {h-schema}applications b
                    where a.name = b.name
                    group by a.name
                  )
                """.trimIndent()
            )
            .apply {
                setParameter("tags", TypedParameterValue(StringArrayType.INSTANCE, tags.toTypedArray()))
            }
            .resultList
            .single() as BigInteger

        val items = session
            .createNativeQuery<ApplicationEntity>(
                // language=sql
                """
                select *
                from {h-schema}applications a
                where
                  jsonb_exists_any(tags, :tags) and
                  a.created_at in (
                    select max(created_at)
                    from {h-schema}applications b
                    where a.name = b.name
                    group by a.name
                  )
                order by a.name
                """.trimIndent(),
                ApplicationEntity::class.java
            )
            .apply {
                setParameter("tags", TypedParameterValue(StringArrayType.INSTANCE, tags.toTypedArray()))

                maxResults = paging.itemsPerPage
                firstResult = paging.page * paging.itemsPerPage
            }
            .resultList
            .map { it.toModelWithInvocation() }

        return preparePageForUser(
            session,
            user,
            Page(
                itemsInTotal.toInt(),
                paging.itemsPerPage,
                paging.page,
                items
            )
        ).mapItems { it.withoutInvocation() }
    }

    override fun search(
        session: HibernateSession,
        user: String,
        query: String,
        paging: NormalizedPaginationRequest
    ): Page<ApplicationSummaryWithFavorite> {
        if (query.isBlank()) {
            return Page(0, paging.itemsPerPage, 0, emptyList())
        }
        val trimmedNormalizedQuery = normalizeQuery(query).trim()
        val keywords = trimmedNormalizedQuery.split(" ")
        if (keywords.size == 1) {
            return doSearch(session, user, trimmedNormalizedQuery, paging)
        }
        val firstTenKeywords = keywords.filter { !it.isBlank() }.take(10)
        return doMultiKeywordSearch(session, user, firstTenKeywords, paging)
    }

    private fun doMultiKeywordSearch(
        session: HibernateSession,
        user: String,
        keywords: List<String>,
        paging: NormalizedPaginationRequest
    ): Page<ApplicationSummaryWithFavorite> {

        var keywordsQuery = "("
        for (i in 0 until keywords.size) {
            if (i == keywords.lastIndex) {
                keywordsQuery += "lower(A.title) like '%' || :query$i || '%'"
                continue
            }
            keywordsQuery += "lower(A.title) like '%'|| :query$i ||'%' or "
        }
        keywordsQuery += ")"
        val count = session.typedQuery<Long>(
            """
            select count (A.title)
            from ApplicationEntity as A where (A.createdAt) in (
                select max(createdAt)
                from ApplicationEntity as B
                where A.title = B.title
                group by title
            ) and $keywordsQuery
            """.trimIndent()
        ).also {
            for ((i, item) in keywords.withIndex()) {
                it.setParameter("query$i", item)
            }
        }.uniqueResult().toInt()

        val items = session.typedQuery<ApplicationEntity>(
            """
            from ApplicationEntity as A where (A.createdAt) in (
                select max(createdAt)
                from ApplicationEntity as B
                where A.title = B.title
                group by title
            ) and $keywordsQuery
            order by A.title
        """.trimIndent()
        ).also {
            for ((i, item) in keywords.withIndex()) {
                it.setParameter("query$i", item)
            }
        }.paginatedList(paging)
            .map { it.toModelWithInvocation() }


        return preparePageForUser(
            session,
            user,
            Page(
                count,
                paging.itemsPerPage,
                paging.page,
                items
            )
        ).mapItems { it.withoutInvocation() }
    }

    private fun doSearch(
        session: HibernateSession,
        user: String,
        normalizedQuery: String,
        paging: NormalizedPaginationRequest
    ): Page<ApplicationSummaryWithFavorite> {
        val count = session.typedQuery<Long>(
            """
            select count (A.title)
            from ApplicationEntity as A where (A.createdAt) in (
                select max(createdAt)
                from ApplicationEntity as B
                where A.title = B.title
                group by title
            ) and lower(A.title) like '%' || :query || '%'
            """.trimIndent()
        ).setParameter("query", normalizedQuery)
            .uniqueResult()
            .toInt()

        val items = session.typedQuery<ApplicationEntity>(
            """
            from ApplicationEntity as A where (A.createdAt) in (
                select max(createdAt)
                from ApplicationEntity as B
                where A.title = B.title
                group by title
            ) and lower(A.title) like '%' || :query || '%'
            order by A.title
        """.trimIndent()
        ).setParameter("query", normalizedQuery).paginatedList(paging)
            .map { it.toModelWithInvocation() }


        return preparePageForUser(
            session,
            user,
            Page(
                count,
                paging.itemsPerPage,
                paging.page,
                items
            )
        ).mapItems { it.withoutInvocation() }
    }

    override fun findAllByName(
        session: HibernateSession,
        user: String?,
        name: String,
        paging: NormalizedPaginationRequest
    ): Page<ApplicationSummaryWithFavorite> {
        return preparePageForUser(
            session,
            user,
            session.paginatedCriteria<ApplicationEntity>(paging) {
                entity[ApplicationEntity::id][EmbeddedNameAndVersion::name] equal name
            }.mapItems { it.toModelWithInvocation() }
        ).mapItems { it.withoutInvocation() }
    }

    override fun findByNameAndVersion(
        session: HibernateSession,
        user: String?,
        name: String,
        version: String
    ): Application {
        val cacheKey = NameAndVersion(name, version)
        val (cached, expiry) = byNameAndVersionCache[cacheKey] ?: Pair(null, 0L)
        if (cached != null && expiry > System.currentTimeMillis()) return cached

        val result = internalByNameAndVersion(session, name, version)
            ?.toModelWithInvocation() ?: throw ApplicationException.NotFound()

        byNameAndVersionCache[cacheKey] = Pair(result, System.currentTimeMillis() + (1000L * 60 * 60))
        return result
    }

    override fun findByNameAndVersionForUser(
        session: HibernateSession,
        user: String,
        name: String,
        version: String
    ): ApplicationWithFavorite {
        val entity = internalByNameAndVersion(session, name, version)?.toModelWithInvocation()
            ?: throw ApplicationException.NotFound()
        return preparePageForUser(session, user, Page(1, 1, 0, listOf(entity))).items.first()
    }

    override fun listLatestVersion(
        session: HibernateSession,
        user: String?,
        paging: NormalizedPaginationRequest
    ): Page<ApplicationSummaryWithFavorite> {
        val count = session.typedQuery<Long>(
            """
            select count (A.id.name)
            from ApplicationEntity as A where (A.createdAt) in (
                select max(createdAt)
                from ApplicationEntity as B
                where A.id.name = B.id.name
                group by id.name
            )
            """.trimIndent()
        ).uniqueResult()
            .toInt()

        val items = session.typedQuery<ApplicationEntity>(
            """
            from ApplicationEntity as A where (A.createdAt) in (
                select max(createdAt)
                from ApplicationEntity as B
                where A.id.name = B.id.name
                group by id.name
            )
            order by A.id.name
        """.trimIndent()
        ).paginatedList(paging)
            .map { it.toModelWithInvocation() }


        return preparePageForUser(
            session,
            user,
            Page(
                count,
                paging.itemsPerPage,
                paging.page,
                items
            )
        ).mapItems { it.withoutInvocation() }
    }

    override fun create(
        session: HibernateSession,
        user: String,
        description: Application,
        originalDocument: String
    ) {
        val existingOwner = findOwnerOfApplication(session, description.metadata.name)
        if (existingOwner != null && existingOwner != user) {
            throw ApplicationException.NotAllowed()
        }

        val existing = internalByNameAndVersion(session, description.metadata.name, description.metadata.version)
        if (existing != null) throw ApplicationException.AlreadyExists()

        val existingTool = toolDAO.internalByNameAndVersion(
            session,
            description.invocation.tool.name,
            description.invocation.tool.version
        ) ?: throw ApplicationException.BadToolReference()

        val entity = ApplicationEntity(
            user,
            Date(),
            Date(),
            description.metadata.authors,
            description.metadata.title,
            description.metadata.description,
            description.metadata.website,
            description.metadata.tags,
            description.invocation,
            existingTool.tool.info.name,
            existingTool.tool.info.version,
            EmbeddedNameAndVersion(description.metadata.name, description.metadata.version)
        )
        session.save(entity)
    }

    override fun updateDescription(
        session: HibernateSession,
        user: String,
        name: String,
        version: String,
        newDescription: String?,
        newAuthors: List<String>?
    ) {
        val existing = internalByNameAndVersion(session, name, version) ?: throw ApplicationException.NotFound()
        if (existing.owner != user) throw ApplicationException.NotAllowed()

        if (newDescription != null) existing.description = newDescription
        if (newAuthors != null) existing.authors = newAuthors

        // We allow for this to be cached for some time. But this instance might as well clear the cache now.
        byNameAndVersionCache.remove(NameAndVersion(name, version))

        session.update(existing)
    }

    private fun internalByNameAndVersion(
        session: HibernateSession,
        name: String,
        version: String
    ): ApplicationEntity? {
        return session
            .criteria<ApplicationEntity> {
                (entity[ApplicationEntity::id][EmbeddedNameAndVersion::name] equal name) and
                        (entity[ApplicationEntity::id][EmbeddedNameAndVersion::version] equal version)
            }
            .uniqueResult()
    }

    private fun findOwnerOfApplication(session: HibernateSession, applicationName: String): String? {
        return session.criteria<ApplicationEntity> {
            entity[ApplicationEntity::id][EmbeddedNameAndVersion::name] equal applicationName
        }.apply {
            maxResults = 1
        }.uniqueResult()?.owner
    }

    private fun preparePageForUser(
        session: HibernateSession,
        user: String?,
        page: Page<Application>
    ): Page<ApplicationWithFavorite> {
        if (!user.isNullOrBlank()) {
            val allFavorites = session
                .criteria<FavoriteApplicationEntity> { entity[FavoriteApplicationEntity::user] equal user }
                .list()

            val preparedPageItems = page.items.map { item ->
                val isFavorite = allFavorites.any { fav ->
                    fav.applicationName == item.metadata.name &&
                            fav.applicationVersion == item.metadata.version
                }

                ApplicationWithFavorite(item.metadata, item.invocation, isFavorite)
            }

            return Page(page.itemsInTotal, page.itemsPerPage, page.pageNumber, preparedPageItems)
        } else {
            val preparedPageItems = page.items.map { ApplicationWithFavorite(it.metadata, it.invocation, false) }
            return Page(page.itemsInTotal, page.itemsPerPage, page.pageNumber, preparedPageItems)
        }
    }

    private fun normalizeQuery(query: String): String {
        return query.toLowerCase()
    }
}

internal fun ApplicationEntity.toMetadata(): ApplicationMetadata = ApplicationMetadata(
    id.name,
    id.version,
    authors,
    title,
    description,
    tags,
    website
)

internal fun ApplicationEntity.toModel(): ApplicationSummary {
    return ApplicationSummary(toMetadata())
}

internal fun ApplicationEntity.toModelWithInvocation(): Application {
    return Application(toMetadata(), application)
}

sealed class ApplicationException(why: String, httpStatusCode: HttpStatusCode) : RPCException(why, httpStatusCode) {
    class NotFound : ApplicationException("Not found", HttpStatusCode.NotFound)
    class NotAllowed : ApplicationException("Not allowed", HttpStatusCode.Forbidden)
    class AlreadyExists : ApplicationException("Already exists", HttpStatusCode.Conflict)
    class BadToolReference : ApplicationException("Tool does not exist", HttpStatusCode.BadRequest)
    class BadApplication : ApplicationException("Application does not exists", HttpStatusCode.NotFound)
}
