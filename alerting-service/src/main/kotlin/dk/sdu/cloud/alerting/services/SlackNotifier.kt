package dk.sdu.cloud.alerting.services

import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.defaultMapper
import dk.sdu.cloud.service.Loggable
import io.ktor.client.HttpClient
import io.ktor.client.call.call
import io.ktor.client.call.receive
import io.ktor.content.TextContent
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import org.slf4j.Logger

private data class SlackMessage(val text: String)

class SlackNotifier(
    val hook: String
) : AlertNotifier {
    private val httpClient = HttpClient()

    override suspend fun onAlert(alert: Alert) {
        val message = alert.message.lines().joinToString("\n") { "> $it" }

        val postResult = httpClient.call(hook) {
            method = HttpMethod.Post
            body = TextContent(defaultMapper.writeValueAsString(SlackMessage(message)), ContentType.Application.Json)
        }

        val status = postResult.response.status
        if (!status.isSuccess()) {
            log.warn("unsuccessful message from slack ($status)")
            runCatching { log.warn(postResult.receive()) }
            throw RPCException.fromStatusCode(HttpStatusCode.InternalServerError)
        }
    }

    companion object : Loggable {
        override val log: Logger = logger()
    }
}
