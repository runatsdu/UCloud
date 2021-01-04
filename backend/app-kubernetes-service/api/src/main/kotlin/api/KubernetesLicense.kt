package dk.sdu.cloud.app.kubernetes.api

import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.FindByStringId
import dk.sdu.cloud.Roles
import dk.sdu.cloud.accounting.api.UCLOUD_PROVIDER
import dk.sdu.cloud.app.orchestrator.api.LicenseProvider
import dk.sdu.cloud.calls.CallDescriptionContainer
import dk.sdu.cloud.calls.TSNamespace
import dk.sdu.cloud.calls.*
import dk.sdu.cloud.service.PageV2
import dk.sdu.cloud.service.PaginationRequestV2
import dk.sdu.cloud.service.PaginationRequestV2Consistency
import dk.sdu.cloud.service.WithPaginationRequestV2

@TSNamespace("compute.ucloud.licenses")
object KubernetesLicenses : LicenseProvider(UCLOUD_PROVIDER)

data class KubernetesLicense(
    val id: String,
    val address: String,
    val port: Int,
    val tags: List<String>,
    val license: String?
)

interface KubernetesLicenseFilter {
    val tag: String?
}

typealias KubernetesLicenseCreateRequest = BulkRequest<KubernetesLicense>
typealias KubernetesLicenseCreateResponse = Unit

data class KubernetesLicenseBrowseRequest(
    override val tag: String? = null,
    override val itemsPerPage: Int? = null,
    override val next: String? = null,
    override val consistency: PaginationRequestV2Consistency? = null,
    override val itemsToSkip: Long? = null
) : WithPaginationRequestV2, KubernetesLicenseFilter
typealias KubernetesLicenseBrowseResponse = PageV2<KubernetesLicense>

typealias KubernetesLicenseDeleteRequest = BulkRequest<FindByStringId>
typealias KubernetesLicenseDeleteResponse = Unit

typealias KubernetesLicenseUpdateRequest = BulkRequest<KubernetesLicense>
typealias KubernetesLicenseUpdateResponse = Unit

@TSNamespace("compute.ucloud.licenses.maintenance")
object KubernetesLicenseMaintenance : CallDescriptionContainer("compute.licenses.ucloud.maintenance") {
    val baseContext  = KubernetesLicenses.baseContext + "/maintenance"

    val create = call<KubernetesLicenseCreateRequest, KubernetesLicenseCreateResponse, CommonErrorMessage>("create") {
        httpCreate(baseContext, roles = Roles.ADMIN)
    }

    val browse = call<KubernetesLicenseBrowseRequest, KubernetesLicenseBrowseResponse, CommonErrorMessage>("browse") {
        httpBrowse(baseContext, roles = Roles.ADMIN)
    }

    val update = call<KubernetesLicenseUpdateRequest, KubernetesLicenseUpdateResponse, CommonErrorMessage>("update") {
        httpUpdate(baseContext, "update", roles = Roles.ADMIN)
    }
}