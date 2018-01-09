package dk.sdu.cloud.project.api

import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.FindByLongId
import dk.sdu.cloud.client.*
import io.netty.handler.codec.http.HttpMethod

/**
 * Contains descriptions of the calls available for this service under /api/projects.
 *
 * Calls that are marked as [RESTCallDescription.shouldProxyFromGateway] are available in direct (service-to-service)
 * connections. The rest are only available at the gateway. Calls that are not available in direct communication are
 * usually messages that go through Kafka instead.
 */
object ProjectDescriptions : RESTDescriptions(ProjectServiceDescription) {
    private val baseContext = "/api/projects"

    // Calls that update state go through Kafka (as indicated by the use of kafkaDescription)
    val create = kafkaDescription<ProjectEvent.Created> {
        method = HttpMethod.POST

        path { using(baseContext) }
        body { bindEntireRequestFromBody() }
    }

    val update = kafkaDescription<ProjectEvent.Updated> {
        method = HttpMethod.PUT
        path { using(baseContext) }
        body { bindEntireRequestFromBody() }
    }

    val delete = kafkaDescription<ProjectEvent.Deleted> {
        method = HttpMethod.DELETE
        path { using(baseContext) }
        body { bindEntireRequestFromBody() }
    }

    // Bundles are used when telling the gateway how to map at the gateway. This is done in ProjectStreams
    internal val projectCommandBundle: KafkaCallDescriptionBundle<ProjectEvent> =
            listOf(create, update, delete)

    // Calls that are queries go through HTTP (as indicated by the use of callDescription)
    val findMyProjects = callDescription<Unit, List<Project>, CommonErrorMessage> {
        method = HttpMethod.GET
        path { using(baseContext) }
    }

    val findById = callDescription<FindByLongId, Project, CommonErrorMessage> {
        method = HttpMethod.GET

        path {
            using(baseContext)
            +boundTo(FindByLongId::id)
        }
    }
}