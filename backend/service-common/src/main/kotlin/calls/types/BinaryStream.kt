package dk.sdu.cloud.calls.types

import com.fasterxml.jackson.core.type.TypeReference
import dk.sdu.cloud.calls.CallDescription
import dk.sdu.cloud.calls.client.HttpClientConverter
import dk.sdu.cloud.calls.server.HttpCall
import dk.sdu.cloud.calls.server.HttpServerConverter
import io.ktor.application.call
import io.ktor.client.statement.*
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.content.OutgoingContent
import io.ktor.http.contentLength
import io.ktor.http.contentType
import io.ktor.request.contentType
import io.ktor.request.receiveChannel
import io.ktor.utils.io.*
import java.nio.charset.Charset

sealed class BinaryStream {
    /**
     * An outgoing binary stream
     */
    class Outgoing(
        private val content: OutgoingContent
    ) : BinaryStream(), HttpServerConverter.OutgoingBody, HttpClientConverter.OutgoingBody {
        override fun clientOutgoingBody(call: CallDescription<*, *, *>): OutgoingContent {
            return content
        }

        override fun serverOutgoingBody(description: CallDescription<*, *, *>, call: HttpCall): OutgoingContent {
            return content
        }
    }

    /**
     * An ingoing binary stream
     */
    class Ingoing(
        val channel: ByteReadChannel,
        val contentType: ContentType? = null,
        val length: Long? = null,
        val contentRange: String? = null
    ) : BinaryStream()

    fun asIngoing(): BinaryStream.Ingoing = this as BinaryStream.Ingoing

    companion object : HttpServerConverter.IngoingBody<BinaryStream>, HttpClientConverter.IngoingBody<BinaryStream> {
        override suspend fun clientIngoingBody(
            description: CallDescription<*, *, *>,
            call: HttpResponse,
            typeReference: TypeReference<BinaryStream>
        ): BinaryStream {
            return Ingoing(
                call.content,
                call.contentType(),
                call.contentLength(),
                call.headers[HttpHeaders.ContentRange]
            )
        }

        override suspend fun serverIngoingBody(description: CallDescription<*, *, *>, call: HttpCall): BinaryStream {
            return Ingoing(
                call.call.receiveChannel(),
                call.call.request.contentType(),
                call.call.request.headers[HttpHeaders.ContentLength]?.toLongOrNull()
            )
        }

        fun outgoingFromText(
            text: String,
            charset: Charset = Charsets.UTF_8,
            contentType: ContentType = ContentType.Text.Any
        ): Outgoing {
            return outgoingFromArray(text.toByteArray(charset), contentType)
        }

        fun outgoingFromArray(
            array: ByteArray,
            contentType: ContentType = ContentType.Application.OctetStream
        ): Outgoing {
            return outgoingFromChannel(ByteReadChannel(array), array.size.toLong(), contentType)
        }

        fun outgoingFromChannel(
            channel: ByteReadChannel,
            contentLength: Long? = null,
            contentType: ContentType = ContentType.Application.OctetStream
        ): Outgoing {
            return Outgoing(object : OutgoingContent.ReadChannelContent() {
                override val contentLength = contentLength
                override val contentType = contentType
                override fun readFrom(): ByteReadChannel = channel
            })
        }
    }
}
