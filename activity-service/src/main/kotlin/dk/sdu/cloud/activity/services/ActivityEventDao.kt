package dk.sdu.cloud.activity.services

import dk.sdu.cloud.activity.api.ActivityEvent
import dk.sdu.cloud.activity.api.ActivityEventType
import dk.sdu.cloud.service.NormalizedPaginationRequest
import dk.sdu.cloud.service.Page

data class ActivityEventFilter(
    val minTimestamp: Long? = null,
    val maxTimestamp: Long? = null,
    val type: ActivityEventType? = null,
    val fileId: String? = null,
    val user: String? = null,
    val offset: Int? = null
)

interface ActivityEventDao {
    fun findByFilePath(
        pagination: NormalizedPaginationRequest,
        filePath: String
    ): Page<ActivityEvent>

    fun findByUser(
        pagination: NormalizedPaginationRequest,
        user: String
    ): Page<ActivityEvent>

    fun findEvents(
        items: Int,
        filter: ActivityEventFilter = ActivityEventFilter()
    ): List<ActivityEvent>

    fun countEvents(
        filter: ActivityEventFilter
    ): Long
}
