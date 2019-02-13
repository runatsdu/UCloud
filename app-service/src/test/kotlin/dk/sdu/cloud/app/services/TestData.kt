package dk.sdu.cloud.app.services

import dk.sdu.cloud.app.api.Application
import dk.sdu.cloud.app.api.ApplicationInvocationDescription
import dk.sdu.cloud.app.api.ApplicationMetadata
import dk.sdu.cloud.app.api.ApplicationParameter
import dk.sdu.cloud.app.api.InvocationParameter
import dk.sdu.cloud.app.api.NameAndVersion
import dk.sdu.cloud.app.api.NormalizedToolDescription
import dk.sdu.cloud.app.api.SimpleDuration
import dk.sdu.cloud.app.api.ToolBackend
import dk.sdu.cloud.app.api.ToolReference
import dk.sdu.cloud.app.api.VariableInvocationParameter
import io.mockk.mockk

val normAppDesc = Application(
    ApplicationMetadata(
        "name",
        "2.2",
        listOf("Authors"),
        "title",
        "app description",
        emptyList(),
        null
    ),
    ApplicationInvocationDescription(
        ToolReference("tool", "1.0.0", null),
        mockk(relaxed = true),
        emptyList(),
        listOf("glob")
    )
)

val normAppDesc2 = normAppDesc.withNameAndVersion("app", "1.2")

val normAppDesc3 = normAppDesc
    .withInvocation(
    listOf(
        VariableInvocationParameter(listOf("int"), prefixVariable = "--int "),
        VariableInvocationParameter(listOf("great"), prefixVariable = "--great "),
        VariableInvocationParameter(listOf("missing"), prefixGlobal = "--missing ")
        )
    )
    .withParameters(
        listOf(
            ApplicationParameter.Integer("int"),
            ApplicationParameter.Text("great", true),
            ApplicationParameter.Integer("missing", true)
        )
    )

fun Application.withNameAndVersion(name: String, version: String): Application {
    return copy(
        metadata = normAppDesc.metadata.copy(
            name = name,
            version = version
        )
    )
}

fun Application.withTags(tags: List<String>): Application = copy(
    metadata = metadata.copy(
        tags = tags
    )
)

fun Application.withInvocation(invocation: List<InvocationParameter>): Application = copy(
    invocation = this.invocation.copy(
        invocation = invocation
    )
)

fun Application.withParameters(parameters: List<ApplicationParameter<*>>): Application = copy(
    invocation = this.invocation.copy(
        parameters = parameters
    )
)

val normToolDesc = NormalizedToolDescription(
    NameAndVersion("tool", "1.0.0"),
    "container",
    2,
    2,
    SimpleDuration(1, 0, 0),
    listOf(""),
    listOf("Author"),
    "title",
    "description",
    ToolBackend.UDOCKER
)
