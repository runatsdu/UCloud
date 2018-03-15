package dk.sdu.cloud.app.api

import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.FindByStringId
import dk.sdu.cloud.client.RESTDescriptions
import dk.sdu.cloud.client.bindEntireRequestFromBody
import io.netty.handler.codec.http.HttpMethod

object HPCJobDescriptions : RESTDescriptions(AppServiceDescription) {
    private const val baseContext = "/api/hpc/jobs"

    val findById = callDescription<FindByStringId, JobWithStatus, CommonErrorMessage> {
        prettyName = "jobsFindById"
        path {
            using(baseContext)
            +boundTo(FindByStringId::id)
        }
    }

    val listRecent = callDescription<PaginationRequest, Page<JobWithStatus>, CommonErrorMessage> {
        prettyName = "jobsListRecent"
        path {
            using(baseContext)
        }

        params {
            +boundTo(PaginationRequest::itemsPerPage)
            +boundTo(PaginationRequest::page)
        }
    }

    val start = callDescription<AppRequest.Start, JobStartedResponse, CommonErrorMessage> {
        prettyName = "jobsStart"
        method = HttpMethod.POST

        path {
            using(baseContext)
        }

        body {
            bindEntireRequestFromBody()
        }
    }
}

data class FindByNameAndVersion(val name: String, val version: String)
data class JobStartedResponse(val jobId: String)
