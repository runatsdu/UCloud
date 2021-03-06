package dk.sdu.cloud.app.orchestrator.api

import dk.sdu.cloud.AccessRight
import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.FindByStringId
import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.app.store.api.ApplicationMetadata
import dk.sdu.cloud.app.store.api.NameAndVersion
import dk.sdu.cloud.app.store.api.WithAppMetadata
import dk.sdu.cloud.calls.CallDescriptionContainer
import dk.sdu.cloud.calls.audit
import dk.sdu.cloud.calls.auth
import dk.sdu.cloud.calls.bindEntireRequestFromBody
import dk.sdu.cloud.calls.call
import dk.sdu.cloud.calls.http
import dk.sdu.cloud.calls.websocket
import dk.sdu.cloud.service.Page
import dk.sdu.cloud.service.WithPaginationRequest
import io.ktor.http.HttpMethod

interface JobQuery {
    val order: SortOrder
    val sortBy: JobSortBy
    val minTimestamp: Long?
    val maxTimestamp: Long?
    val filter: JobState?
    val application: String?
    val version: String?
}

data class ListRecentRequest(
    override val itemsPerPage: Int? = null,
    override val page: Int? = null,
    override val order: SortOrder = SortOrder.DESCENDING,
    override val sortBy: JobSortBy = JobSortBy.CREATED_AT,
    override val minTimestamp: Long? = null,
    override val maxTimestamp: Long? = null,
    override val filter: JobState? = null,
    override val application: String? = null,
    override val version: String? = null
) : WithPaginationRequest, JobQuery

enum class SortOrder {
    ASCENDING,
    DESCENDING
}

enum class JobSortBy {
    NAME,
    STATE,
    APPLICATION,
    STARTED_AT,
    LAST_UPDATE,
    CREATED_AT
}

typealias MachineTypesRequest = Unit
typealias MachineTypesResponse = List<Product.Compute>

/**
 * Call descriptions for the endpoint `/api/hpc/jobs`
 */
object JobDescriptions : CallDescriptionContainer("hpc.jobs") {
    const val baseContext = "/api/hpc/jobs"

    /**
     * Finds a job by it's ID.
     *
     * Queries a job by its ID and returns the resulting job along with its status. Only the user who
     * owns the job is allowed to receive the result.
     */
    val findById = call<FindByStringId, JobWithStatus, CommonErrorMessage>("findById") {
        auth {
            access = AccessRight.READ
        }

        http {
            path {
                using(baseContext)
                +boundTo(FindByStringId::id)
            }
        }
    }

    /**
     * Lists a user's recent jobs
     */
    val listRecent = call<ListRecentRequest, Page<JobWithStatus>, CommonErrorMessage>("listRecent") {
        auth {
            access = AccessRight.READ
        }

        http {
            path {
                using(baseContext)
            }

            params {
                +boundTo(ListRecentRequest::itemsPerPage)
                +boundTo(ListRecentRequest::page)
                +boundTo(ListRecentRequest::sortBy)
                +boundTo(ListRecentRequest::order)
                +boundTo(ListRecentRequest::minTimestamp)
                +boundTo(ListRecentRequest::maxTimestamp)
                +boundTo(ListRecentRequest::filter)
                +boundTo(ListRecentRequest::application)
                +boundTo(ListRecentRequest::version)
            }
        }
    }

    /**
     * Starts a job.
     */
    val start = call<StartJobRequest, JobStartedResponse, CommonErrorMessage>("start") {
        auth {
            access = AccessRight.READ_WRITE
        }

        http {
            method = HttpMethod.Post

            path {
                using(baseContext)
            }

            body {
                bindEntireRequestFromBody()
            }
        }
    }

    /**
     * Sends a request to cancel the job
     */
    val cancel = call<CancelRequest, CancelResponse, CommonErrorMessage>("cancel") {
        auth {
            access = AccessRight.READ_WRITE
        }

        http {
            method = HttpMethod.Delete

            path {
                using(baseContext)
            }

            body { bindEntireRequestFromBody() }
        }
    }

    /**
     * Follows the std streams of a job.
     */
    @Deprecated("Replaced with web sockets")
    val follow = call<FollowStdStreamsRequest, FollowStdStreamsResponse, CommonErrorMessage>("follow") {
        auth {
            access = AccessRight.READ
        }

        http {
            method = HttpMethod.Get

            path {
                using(baseContext)
                +"follow"
                +boundTo(FollowStdStreamsRequest::jobId)
            }

            params {
                +boundTo(FollowStdStreamsRequest::stderrLineStart)
                +boundTo(FollowStdStreamsRequest::stderrMaxLines)
                +boundTo(FollowStdStreamsRequest::stdoutLineStart)
                +boundTo(FollowStdStreamsRequest::stdoutMaxLines)
            }
        }
    }

    /**
     * Follows the std streams of a job via websockets
     */
    val followWS = call<FollowWSRequest, FollowWSResponse, CommonErrorMessage>("followWS") {
        audit<FollowWSRequest> {
            longRunningResponseTime = true
        }

        auth {
            access = AccessRight.READ
        }

        websocket(baseContext)
    }

    /**
     * Queries the job service about VNC connection parameters
     */
    val queryVncParameters =
        call<QueryVncParametersRequest, QueryVncParametersResponse, CommonErrorMessage>("queryVncParameters") {
            auth {
                access = AccessRight.READ
            }

            http {
                path {
                    using(baseContext)
                    +"query-vnc"
                    +boundTo(QueryVncParametersRequest::jobId)
                }
            }
        }

    /**
     * Queries the job service about web app connection parameters
     */
    val queryWebParameters =
        call<QueryWebParametersRequest, QueryWebParametersResponse, CommonErrorMessage>("queryWebParameters") {
            auth {
                access = AccessRight.READ
            }

            http {
                path {
                    using(baseContext)
                    +"query-web"
                    +boundTo(QueryWebParametersRequest::jobId)
                }
            }
        }

    val machineTypes = call<MachineTypesRequest, MachineTypesResponse, CommonErrorMessage>("machineTypes") {
        auth {
            access = AccessRight.READ
        }

        http {
            path {
                using(baseContext)
                +"machine-types"
            }
        }
    }
}

data class FindByNameAndVersion(val name: String, val version: String)
data class JobStartedResponse(val jobId: String)

data class FollowStdStreamsRequest(
    /**
     * The ID of the [JobWithStatus] to follow
     *
     * Must be positive
     */
    val jobId: String,

    /**
     * The line index to start at (0-indexed) for stdout
     *
     * Must be positive
     */
    val stdoutLineStart: Int,

    /**
     * The maximum amount of lines to retrieve for stdout. Fewer lines can be returned.
     */
    val stdoutMaxLines: Int,

    /**
     * The line index to start at (0-indexed) for stderr
     *
     * Must be positive
     */
    val stderrLineStart: Int,

    /**
     * The maximum amount of lines to retrieve for stderr. Fewer lines can be returned.
     *
     * Must be positive
     */
    val stderrMaxLines: Int
) {
    init {
        if (stderrMaxLines < 0) throw IllegalArgumentException("stderrMaxLines < 0")
        if (stdoutMaxLines < 0) throw IllegalArgumentException("stdoutMaxLines < 0")
        if (stdoutLineStart < 0) throw IllegalArgumentException("stdoutLineStart < 0")
        if (stderrLineStart < 0) throw IllegalArgumentException("stderrLinesStart < 0")
    }
}

data class FollowStdStreamsResponse(
    /**
     * The lines for stdout
     */
    val stdout: String,

    /**
     * The next line index. See [FollowStdStreamsRequest.stderrLineStart]
     */
    val stdoutNextLine: Int,

    /**
     * The lines for stderr
     */
    val stderr: String,

    /**
     * The next line index. See [FollowStdStreamsRequest.stderrLineStart]
     */
    val stderrNextLine: Int,

    /**
     * [NameAndVersion] for the application running.
     */
    @Deprecated("Should no longer be used. Use metadata instead")
    val application: NameAndVersion,

    /**
     * The application's current state
     */
    val state: JobState,

    /**
     * The current status
     */
    val status: String,

    /**
     * true if the application has completed (successfully or not) otherwise false
     */
    val complete: Boolean,

    /**
     * The state that was reached when the job failed, null if the job did not fail
     */
    val failedState: JobState?,

    /**
     * Time (in milliseconds) left of the job
     */
    val timeLeft: Long?,

    /**
     * The job ID
     */
    val id: String,

    /**
     * The job name
     */
    val name: String?,


    val outputFolder: String? = null,

    override val metadata: ApplicationMetadata
) : WithAppMetadata

data class InternalFollowStdStreamsRequest(
    val job: VerifiedJob,

    /**
     * The line index to start at (0-indexed) for stdout
     *
     * Must be positive
     */
    val stdoutLineStart: Int,

    /**
     * The maximum amount of lines to retrieve for stdout. Fewer lines can be returned.
     */
    val stdoutMaxLines: Int,

    /**
     * The line index to start at (0-indexed) for stderr
     *
     * Must be positive
     */
    val stderrLineStart: Int,

    /**
     * The maximum amount of lines to retrieve for stderr. Fewer lines can be returned.
     *
     * Must be positive
     */
    val stderrMaxLines: Int
) {
    init {
        if (stderrMaxLines < 0) throw IllegalArgumentException("stderrMaxLines < 0")
        if (stdoutMaxLines < 0) throw IllegalArgumentException("stdoutMaxLines < 0")
        if (stdoutLineStart < 0) throw IllegalArgumentException("stdoutLineStart < 0")
        if (stderrLineStart < 0) throw IllegalArgumentException("stderrLinesStart < 0")
    }
}

data class InternalStdStreamsResponse(
    val stdout: String,
    val stdoutNextLine: Int,
    val stderr: String,
    val stderrNextLine: Int
)

data class FollowWSRequest(
    val jobId: String,
    val stdoutLineStart: Int,
    val stderrLineStart: Int
)

/**
 * A response for following the std streams of a job.
 *
 * Any of these fields may be not-null if there is new job available. If there is no new information in this
 * packet null will be returned.
 */
data class FollowWSResponse(
    val stdout: String? = null,
    val stderr: String? = null,
    val status: String? = null,
    val state: JobState? = null,
    val failedState: JobState? = null
)

data class CancelWSStreamRequest(val streamId: String)
typealias CancelWSStreamResponse = Unit

data class InternalFollowWSStreamRequest(
    val job: VerifiedJob,
    val stdoutLineStart: Int,
    val stderrLineStart: Int
)

data class InternalFollowWSStreamResponse(
    val streamId: String,
    val stdout: String? = null,
    val stderr: String? = null
)

data class QueryVncParametersRequest(
    val jobId: String
)

data class QueryVncParametersResponse(
    val path: String,
    val password: String? = null
)

data class QueryWebParametersRequest(
    val jobId: String
)

data class QueryWebParametersResponse(
    val path: String
)

data class CancelRequest(val jobId: String)
typealias CancelResponse = Unit
