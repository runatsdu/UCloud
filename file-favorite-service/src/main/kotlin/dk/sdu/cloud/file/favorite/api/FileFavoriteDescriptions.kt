package dk.sdu.cloud.file.favorite.api

import dk.sdu.cloud.AccessRight
import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.client.RESTDescriptions
import dk.sdu.cloud.client.bindEntireRequestFromBody
import dk.sdu.cloud.file.api.FileDescriptions
import dk.sdu.cloud.file.api.StorageFile
import io.ktor.http.HttpMethod

data class ToggleFavoriteRequest(
    val path: String
)

data class ToggleFavoriteResponse(
    val failures: List<String>
)

data class FavoriteStatusRequest(
    val files: List<StorageFile>
)

/**
 * Contains a mapping between [StorageFile.fileId] and their [FavoriteStatus]
 */
data class FavoriteStatusResponse(
    val favorited: Map<String, Boolean>
)

object FileFavoriteDescriptions : RESTDescriptions("${FileDescriptions.namespace}.favorite") {
    val baseContext = "/api/files/favorite"

    internal val toggleFavoriteDelete = callDescription<ToggleFavoriteRequest, ToggleFavoriteResponse, CommonErrorMessage> {
        name = "toggleFavorite"
        method = HttpMethod.Delete

        auth {
            access = AccessRight.READ_WRITE
        }

        path {
            using(baseContext)
        }

        params {
            +boundTo(ToggleFavoriteRequest::path)
        }
    }

    val toggleFavorite = callDescription<ToggleFavoriteRequest, ToggleFavoriteResponse, CommonErrorMessage> {
        name = "toggleFavorite"
        method = HttpMethod.Post

        auth {
            access = AccessRight.READ_WRITE
        }

        path {
            using(baseContext)
        }

        params {
            +boundTo(ToggleFavoriteRequest::path)
        }
    }

    val favoriteStatus = callDescription<FavoriteStatusRequest, FavoriteStatusResponse, CommonErrorMessage> {
        name = "favoriteStatus"
        method = HttpMethod.Post

        auth {
            access = AccessRight.READ
        }

        path {
            using(baseContext)
            +"status"
        }

        body { bindEntireRequestFromBody() }
    }
}
