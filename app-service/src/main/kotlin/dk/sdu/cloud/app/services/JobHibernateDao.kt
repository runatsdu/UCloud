package dk.sdu.cloud.app.services

import dk.sdu.cloud.app.api.JobState
import dk.sdu.cloud.app.api.NameAndVersion
import dk.sdu.cloud.app.api.ParsedApplicationParameter
import dk.sdu.cloud.app.api.SimpleDuration
import dk.sdu.cloud.app.api.ValidatedFileForUpload
import dk.sdu.cloud.app.api.VerifiedJob
import dk.sdu.cloud.app.api.VerifiedJobInput
import dk.sdu.cloud.service.NormalizedPaginationRequest
import dk.sdu.cloud.service.Page
import dk.sdu.cloud.service.db.HibernateEntity
import dk.sdu.cloud.service.db.HibernateSession
import dk.sdu.cloud.service.db.JSONB_LIST_PARAM_TYPE
import dk.sdu.cloud.service.db.JSONB_LIST_TYPE
import dk.sdu.cloud.service.db.JSONB_MAP_PARAM_KEY_TYPE
import dk.sdu.cloud.service.db.JSONB_MAP_PARAM_VALUE_TYPE
import dk.sdu.cloud.service.db.JSONB_MAP_TYPE
import dk.sdu.cloud.service.db.JSONB_TYPE
import dk.sdu.cloud.service.db.WithId
import dk.sdu.cloud.service.db.WithTimestamps
import dk.sdu.cloud.service.db.get
import dk.sdu.cloud.service.db.paginatedCriteria
import dk.sdu.cloud.service.mapItems
import org.hibernate.annotations.NaturalId
import org.hibernate.annotations.Parameter
import org.hibernate.annotations.Type
import org.hibernate.usertype.DynamicParameterizedType
import java.util.*
import javax.persistence.AttributeOverride
import javax.persistence.AttributeOverrides
import javax.persistence.Column
import javax.persistence.Embedded
import javax.persistence.Entity
import javax.persistence.EnumType
import javax.persistence.Enumerated
import javax.persistence.Id
import javax.persistence.Table

@Entity
@Table(name = "job_information")
data class JobInformationEntity(
    @Id
    @NaturalId
    val systemId: String,

    var owner: String,

    @Embedded
    @AttributeOverrides(
        AttributeOverride(name = "name", column = Column(name = "application_name")),
        AttributeOverride(name = "version", column = Column(name = "application_version"))
    )
    var application: EmbeddedNameAndVersion,

    var status: String,

    @Enumerated(EnumType.STRING)
    var state: JobState,

    var nodes: Int,

    var tasksPerNode: Int,

    @Type(
        type = JSONB_MAP_TYPE,
        parameters = [
            Parameter(
                name = JSONB_MAP_PARAM_KEY_TYPE,
                value = "java.lang.String"
            ),
            Parameter(
                name = JSONB_MAP_PARAM_VALUE_TYPE,
                value = "dk.sdu.cloud.app.api.ParsedApplicationParameter"
            )
        ]
    )
    var parameters: Map<String, ParsedApplicationParameter?>,

    @Type(
        type = JSONB_LIST_TYPE,
        parameters = [
            Parameter(
                name = JSONB_LIST_PARAM_TYPE,
                value = "dk.sdu.cloud.app.api.ValidatedFileForUpload"
            )
        ]
    )
    var files: List<ValidatedFileForUpload>,

    var maxTimeHours: Int,

    var maxTimeMinutes: Int,

    var maxTimeSeconds: Int,

    var backendName: String,

    @Column(length = 4096)
    var accessToken: String,

    override var createdAt: Date,

    override var modifiedAt: Date
) : WithTimestamps {
    companion object : HibernateEntity<JobInformationEntity>, WithId<String>
}

class JobHibernateDao(
    private val appDao: ApplicationDAO<HibernateSession>
) : JobDao<HibernateSession> {
    override fun create(session: HibernateSession, jobWithToken: VerifiedJobWithAccessToken) {
        val (job, token) = jobWithToken

        val entity = JobInformationEntity(
            job.id,
            job.owner,
            job.application.description.info.toEmbedded(),
            "Verified",
            job.currentState,
            job.nodes,
            job.tasksPerNode,
            job.jobInput.asMap(),
            job.files,
            job.maxTime.hours,
            job.maxTime.minutes,
            job.maxTime.seconds,
            job.backend,
            token,
            Date(System.currentTimeMillis()),
            Date(System.currentTimeMillis())
        )

        session.save(entity)
    }

    override fun updateStatus(session: HibernateSession, systemId: String, status: String) {
        val entity = JobInformationEntity[session, systemId] ?: throw JobException.NotFound("job: $systemId")
        entity.status = status
        session.save(entity)
    }

    override fun updateStateAndStatus(session: HibernateSession, systemId: String, state: JobState, status: String?) {
        val entity = JobInformationEntity[session, systemId] ?: throw JobException.NotFound("job: $systemId")
        entity.state = state
        if (status != null) {
            entity.status = status
        }
        session.save(entity)
    }

    override fun findOrNull(
        session: HibernateSession,
        systemId: String,
        owner: String?
    ): VerifiedJobWithAccessToken? {
        return JobInformationEntity[session, systemId]
            ?.takeIf { owner == null || it.owner == owner }
            ?.toModel(session)
    }

    override fun list(
        session: HibernateSession,
        owner: String,
        pagination: NormalizedPaginationRequest
    ): Page<VerifiedJobWithAccessToken> {
        return session.paginatedCriteria<JobInformationEntity>(
            pagination,
            orderBy = { listOf(descinding(entity[JobInformationEntity::createdAt])) },
            predicate = {
                entity[JobInformationEntity::owner] equal owner
            }
        ).mapItems { it.toModel(session) } // TODO This will do a query for every single result!
    }

    private fun JobInformationEntity.toModel(session: HibernateSession): VerifiedJobWithAccessToken =
        VerifiedJobWithAccessToken(
            VerifiedJob(
                appDao.findByNameAndVersion(session, owner, application.name, application.version),
                files,
                systemId,
                owner,
                nodes,
                tasksPerNode,
                SimpleDuration(maxTimeHours, maxTimeMinutes, maxTimeSeconds),
                VerifiedJobInput(parameters),
                backendName,
                state,
                status,
                createdAt.time,
                modifiedAt.time
            ),
            accessToken
        )

    private fun NameAndVersion.toEmbedded(): EmbeddedNameAndVersion = EmbeddedNameAndVersion(name, version)
}