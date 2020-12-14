package dk.sdu.cloud.integration.backend

import dk.sdu.cloud.accounting.api.ProductReference
import dk.sdu.cloud.app.orchestrator.api.*
import dk.sdu.cloud.calls.bulkRequestOf
import dk.sdu.cloud.calls.client.call
import dk.sdu.cloud.calls.client.orThrow
import dk.sdu.cloud.integration.IntegrationTest
import dk.sdu.cloud.integration.retrySection
import dk.sdu.cloud.integration.t
import dk.sdu.cloud.service.test.assertThatInstance
import kotlin.test.*

class Ingress : IntegrationTest() {
    @Test
    fun `test ingress create and delete`() = t {
        val root = initializeRootProject()
        val user = createUser()
        addFundsToPersonalProject(root, user.username, sampleIngress.category)

        val browseResults = Ingresses.browse.call(
            IngressesBrowseRequest(),
            user.client
        ).orThrow()

        assertThatInstance(browseResults, "should be empty") { it.items.isEmpty() }

        val product = ProductReference(sampleIngress.id, sampleIngress.category.id, sampleIngress.category.provider)
        val settings = Ingresses.retrieveSettings.call(
            product,
            user.client
        ).orThrow()

        val id = Ingresses.create.call(
            bulkRequestOf(
                IngressCreateRequestItem("${settings.domainPrefix}domain${settings.domainSuffix}", product)
            ),
            user.client
        ).orThrow().ids.single()

        retrySection {
            val retrievedIngress = Ingresses.retrieve.call(
                IngressesRetrieveRequest(id),
                user.client
            ).orThrow()

            assertThatInstance(retrievedIngress, "should be ready") { it.status.state == IngressState.READY }
        }

        val newBrowseResults = Ingresses.browse.call(
            IngressesBrowseRequest(),
            user.client
        ).orThrow()

        assertThatInstance(newBrowseResults, "has a single ingress") { it.items.size == 1 }

        Ingresses.delete.call(
            bulkRequestOf(IngressRetrieve(id)),
            user.client
        ).orThrow()

        val browseAfterDelete = Ingresses.browse.call(
            IngressesBrowseRequest(),
            user.client
        ).orThrow()

        assertThatInstance(browseAfterDelete, "has no items") { it.items.isEmpty() }
    }

    @Test
    fun `find by domain`() = t {
        val root = initializeRootProject()
        val user = createUser()
        addFundsToPersonalProject(root, user.username, sampleIngress.category)

        val browseResults = Ingresses.browse.call(
            IngressesBrowseRequest(),
            user.client
        ).orThrow()

        assertThatInstance(browseResults, "should be empty") { it.items.isEmpty() }

        val product = ProductReference(sampleIngress.id, sampleIngress.category.id, sampleIngress.category.provider)
        val settings = Ingresses.retrieveSettings.call(
            product,
            user.client
        ).orThrow()

        val domain = "${settings.domainPrefix}domain${settings.domainSuffix}"
        val id = Ingresses.create.call(
            bulkRequestOf(
                IngressCreateRequestItem(domain, product)
            ),
            user.client
        ).orThrow().ids.single()

        val browseWithDomain = Ingresses.browse.call(
            IngressesBrowseRequest(domain = domain),
            user.client
        ).orThrow()

        assertThatInstance(browseWithDomain, "found the ingress") { it.items.single().domain == domain }

        val browseWithBadDomain = Ingresses.browse.call(
            IngressesBrowseRequest(domain = "somethingelseentirely"),
            user.client
        ).orThrow()

        assertThatInstance(browseWithBadDomain, "finds nothing") { it.items.isEmpty() }
    }
}