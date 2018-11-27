package dk.sdu.cloud.file.stats.api

import dk.sdu.cloud.AccessRight
import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.client.RESTDescriptions
import dk.sdu.cloud.file.api.FileType
import dk.sdu.cloud.file.api.SensitivityLevel
import io.ktor.http.HttpMethod

data class UsageRequest(val path: String? = null)
data class UsageResponse(val bytes: Long, val path: String)

typealias RecentFilesRequest = Unit
data class RecentFilesResponse(
    val recentFiles: List<SearchResult>
)

data class SearchResult(
    val path: String,
    val fileType: FileType,
    val annotations: Set<kotlin.String>,
    val createdAt: Long,
    val fileId: String,
    val link: Boolean,
    val modifiedAt: Long,
    val ownerName: String,
    val sensitivityLevel: SensitivityLevel
)

object FileStatsDescriptions : RESTDescriptions("files.stats") {
    val baseContext = "/api/files/stats"

    val usage = callDescription<UsageRequest, UsageResponse, CommonErrorMessage> {
        name = "usage"
        method = HttpMethod.Get

        auth {
            access = AccessRight.READ
        }

        path {
            using(baseContext)
            +"usage"
        }

        params {
            +boundTo(UsageRequest::path)
        }
    }

    val recent = callDescription<RecentFilesRequest, RecentFilesResponse, CommonErrorMessage> {
        name = "recent"
        method = HttpMethod.Get

        auth {
            access = AccessRight.READ
        }

        path {
            using(baseContext)
            +"recent"
        }
    }
}