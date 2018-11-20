package dk.sdu.cloud.service.test

import dk.sdu.cloud.AccessRight
import dk.sdu.cloud.SecurityScope
import dk.sdu.cloud.client.AuthenticatedCloud
import dk.sdu.cloud.client.CloudContext
import dk.sdu.cloud.client.PreparedRESTCall
import dk.sdu.cloud.client.RESTCallDescription
import dk.sdu.cloud.client.RESTDescriptions
import dk.sdu.cloud.client.RESTResponse
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.response.HttpResponse
import io.ktor.http.Headers
import io.ktor.http.HttpStatusCode
import io.mockk.MockKMatcherScope
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.unmockkObject
import kotlinx.coroutines.io.ByteReadChannel
import java.net.ConnectException

object CloudContextMock : CloudContext {
    override fun resolveEndpoint(namespace: String): String {
        throw IllegalStateException("You need to mock the call using CloudMock.mockCall()")
    }

    override fun tryReconfigurationOnConnectException(call: PreparedRESTCall<*, *>, ex: ConnectException): Boolean {
        throw IllegalStateException("You need to mock the call using CloudMock.mockCall()")
    }

}

object CloudMock : AuthenticatedCloud {
    @PublishedApi
    internal val activeScopes = ArrayList<Any>()

    override val parent: CloudContext = CloudContextMock

    override fun HttpRequestBuilder.configureCall() {
        throw IllegalStateException("You need to mock the call using CloudMock.mockCall()")
    }

    fun initialize() {
        reset()
    }

    inline fun <reified R : Any, S : Any, E : Any> mockCall(
        descriptions: RESTDescriptions,
        crossinline call: MockKMatcherScope.() -> RESTCallDescription<R, S, E, *>,
        crossinline resultCompute: (R) -> TestCallResult<S, E>
    ) {
        if (descriptions !in activeScopes) {
            mockkObject(descriptions)
        }

        activeScopes.add(descriptions)

        every { call().requiredAuthScope } answers {
            SecurityScope.construct(
                listOf(descriptions.namespace),
                AccessRight.READ
            )
        }

        coEvery { call().call(any(), any()) } answers {
            val payload = invocation.args.first() as R
            val resp = resultCompute(payload)

            val httpResponse = mockk<HttpResponse>(relaxed = true)
            every { httpResponse.status } returns resp.statusCode
            every { httpResponse.headers } returns Headers.Empty
            every { httpResponse.content } returns ByteReadChannel.Empty

            when (resp) {
                is TestCallResult.Ok -> RESTResponse.Ok(httpResponse, resp.result)
                is TestCallResult.Error -> RESTResponse.Err(httpResponse, resp.error)
            }
        }
    }

    inline fun <reified R : Any, S : Any, E : Any> mockCallSuccess(
        descriptions: RESTDescriptions,
        crossinline call: MockKMatcherScope.() -> RESTCallDescription<R, S, E, *>,
        result: S,
        statusCode: HttpStatusCode = HttpStatusCode.OK
    ) {
        mockCall(descriptions, call) { TestCallResult.Ok(result, statusCode) }
    }

    inline fun <reified R : Any, S : Any, E : Any> mockCallError(
        descriptions: RESTDescriptions,
        crossinline call: MockKMatcherScope.() -> RESTCallDescription<R, S, E, *>,
        error: E? = null,
        statusCode: HttpStatusCode
    ) {
        mockCall(descriptions, call) { TestCallResult.Error(error, statusCode) }
    }

    fun reset() {
        activeScopes.forEach {
            unmockkObject(it)
        }

        activeScopes.clear()
    }
}

sealed class TestCallResult<S, E> {
    abstract val statusCode: HttpStatusCode

    data class Ok<S, E>(val result: S, override val statusCode: HttpStatusCode = HttpStatusCode.OK) :
        TestCallResult<S, E>()

    data class Error<S, E>(val error: E?, override val statusCode: HttpStatusCode) : TestCallResult<S, E>()
}