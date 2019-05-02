package dk.sdu.cloud.app.kubernetes.services

import dk.sdu.cloud.app.api.ComputationCallbackDescriptions
import dk.sdu.cloud.app.api.JobCompletedRequest
import dk.sdu.cloud.app.api.JobState
import dk.sdu.cloud.app.api.SimpleDuration
import dk.sdu.cloud.app.api.StateChangeRequest
import dk.sdu.cloud.app.api.SubmitComputationResult
import dk.sdu.cloud.app.api.VerifiedJob
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.calls.client.AuthenticatedClient
import dk.sdu.cloud.calls.client.call
import dk.sdu.cloud.calls.client.orThrow
import dk.sdu.cloud.calls.types.BinaryStream
import dk.sdu.cloud.service.Loggable
import io.fabric8.kubernetes.api.model.Container
import io.fabric8.kubernetes.api.model.ContainerBuilder
import io.fabric8.kubernetes.api.model.DoneablePod
import io.fabric8.kubernetes.api.model.EmptyDirVolumeSource
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder
import io.fabric8.kubernetes.api.model.PersistentVolumeClaimVolumeSource
import io.fabric8.kubernetes.api.model.Pod
import io.fabric8.kubernetes.api.model.PodSpecBuilder
import io.fabric8.kubernetes.api.model.PodTemplateSpecBuilder
import io.fabric8.kubernetes.api.model.Volume
import io.fabric8.kubernetes.api.model.VolumeBuilder
import io.fabric8.kubernetes.api.model.VolumeMount
import io.fabric8.kubernetes.api.model.batch.DoneableJob
import io.fabric8.kubernetes.api.model.batch.Job
import io.fabric8.kubernetes.api.model.batch.JobSpecBuilder
import io.fabric8.kubernetes.client.KubernetesClient
import io.fabric8.kubernetes.client.KubernetesClientException
import io.fabric8.kubernetes.client.Watcher
import io.fabric8.kubernetes.client.dsl.ExecListener
import io.fabric8.kubernetes.client.dsl.ExecWatch
import io.fabric8.kubernetes.client.dsl.PodResource
import io.fabric8.kubernetes.client.dsl.internal.PodOperationsImpl
import io.ktor.http.HttpStatusCode
import io.ktor.util.cio.readChannel
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import okhttp3.Response
import java.io.InputStream
import java.io.OutputStream
import java.io.PipedInputStream
import java.io.PipedOutputStream
import java.nio.file.Files
import java.time.ZonedDateTime
import java.util.concurrent.CountDownLatch

private const val JOB_PREFIX = "job-"
private const val ROLE_LABEL = "role"
private const val APP_ROLE = "sducloud-app"

class PodService(
    private val k8sClient: KubernetesClient,
    private val serviceClient: AuthenticatedClient,
    private val namespace: String = "app-kubernetes"
) {
    private val dataDirectory = "/data"
    private val localDirectory = "/scratch"
    private val temporaryStorage = "temporary-storage"
    private val dataStorage = "workspace-storage"
    private val finishedJobs = HashSet<String>()

    private fun podName(requestId: String): String = "$JOB_PREFIX$requestId"
    private fun reverseLookupJobName(podName: String): String? =
        if (podName.startsWith(JOB_PREFIX)) podName.removePrefix(JOB_PREFIX) else null

    private fun findPod(jobName: String?): Pod? =
        k8sClient.pods().inNamespace(namespace).withLabel("job-name", jobName).list().items.firstOrNull()

    fun initializeListeners() {
        fun handlePodEvent(job: Job) {
            val jobName = job.metadata.name
            val jobId = reverseLookupJobName(jobName) ?: return

            val firstOrNull = job.status?.conditions?.firstOrNull()
            if (firstOrNull != null && firstOrNull.type == "Failed" && firstOrNull.reason == "DeadlineExceeded" &&
                jobId !in finishedJobs) {
                finishedJobs.add(jobId)

                GlobalScope.launch {
                    ComputationCallbackDescriptions.requestStateChange.call(
                        StateChangeRequest(
                            jobId,
                            JobState.TRANSFER_SUCCESS,
                            job.status.conditions.first().message
                        ),
                        serviceClient
                    ).orThrow()

                    // TODO FIXME We should still do accounting for the time we spent running code
                    ComputationCallbackDescriptions.completed.call(
                        JobCompletedRequest(
                            jobId,
                            SimpleDuration(0, 0, 0),
                            false
                        ),
                        serviceClient
                    ).orThrow()
                }

                return
            }

            val resource = findPod(jobName)!!
            val userContainer = resource.status.containerStatuses.getOrNull(0) ?: return

            val containerState = userContainer.state.terminated
            if (containerState != null && jobId !in finishedJobs && containerState.startedAt != null) {
                val startAt = ZonedDateTime.parse(containerState.startedAt).toInstant().toEpochMilli()
                val finishedAt =
                    ZonedDateTime.parse(containerState.finishedAt).toInstant().toEpochMilli()
                log.info("App finished in ${finishedAt - startAt}ms")

                log.debug("Downloading log")
                val logFile = Files.createTempFile("log", ".txt").toFile()
                k8sClient.pods().inNamespace(namespace).withName(resource.metadata.name).logReader.use { ins ->
                    logFile.writer().use { out ->
                        ins.copyTo(out)
                    }
                }
                log.debug("Log retrieved")

                val duration = run {
                    // We add 5 seconds for just running the application.
                    // It seems unfair that a job completing instantly is accounted for nothing.
                    val durationMs = (finishedAt - startAt) + 5_000
                    val hours = durationMs / (1000 * 60 * 60)
                    val minutes = (durationMs % (1000 * 60 * 60)) / (1000 * 60)
                    val seconds = ((durationMs % (1000 * 60 * 60)) % (1000 * 60)) / 1000


                    SimpleDuration(hours.toInt(), minutes.toInt(), seconds.toInt())
                }
                log.info("Simple duration $duration")

                finishedJobs.add(jobId)

                GlobalScope.launch {
                    ComputationCallbackDescriptions.requestStateChange.call(
                        StateChangeRequest(
                            jobId,
                            JobState.TRANSFER_SUCCESS,
                            "Job has finished. Total duration: $duration."
                        ),
                        serviceClient
                    ).orThrow()

                    ComputationCallbackDescriptions.submitFile.call(
                        SubmitComputationResult(
                            jobId,
                            "stdout.txt",
                            false,
                            BinaryStream.outgoingFromChannel(logFile.readChannel(), logFile.length())
                        ),
                        serviceClient
                    ).orThrow()


                    log.info("Calling completed")
                    ComputationCallbackDescriptions.completed.call(
                        JobCompletedRequest(
                            jobId,
                            duration,
                            containerState.exitCode == 0
                        ),
                        serviceClient
                    ).orThrow()
                }
            }
        }

        // Handle old pods on start up
        k8sClient.batch().jobs().inNamespace(namespace).withLabel(ROLE_LABEL, APP_ROLE).list().items.forEach {
            handlePodEvent(it)
        }

        // Watch for new pods
        k8sClient.batch().jobs().inNamespace(namespace).withLabel(ROLE_LABEL, APP_ROLE).watch(object : Watcher<Job> {
            override fun onClose(cause: KubernetesClientException?) {
                // Do nothing
            }

            override fun eventReceived(action: Watcher.Action, resource: Job) {
                handlePodEvent(resource)
            }
        })
    }

    fun create(verifiedJob: VerifiedJob) {
        val podName = podName(verifiedJob.id)

        log.info("Creating new job with name: $podName")

        k8sClient.batch().jobs().inNamespace(namespace).createNew()
            .metadata {
                withName(podName)
                withNamespace(this@PodService.namespace)

                withLabels(
                    mapOf(
                        ROLE_LABEL to APP_ROLE
                    )
                )
            }
            .spec {
                val deadline = verifiedJob.maxTime.toSeconds()
                withActiveDeadlineSeconds(deadline)
                withBackoffLimit(1)
                withParallelism(1)

                withTemplate(
                    PodTemplateSpecBuilder().apply {
                        metadata {
                            withName(podName)
                            withNamespace(this@PodService.namespace)

                            withLabels(
                                mapOf(
                                    ROLE_LABEL to APP_ROLE
                                )
                            )
                        }

                        spec {
                            withContainers(
                                container {
                                    val app = verifiedJob.application.invocation
                                    val tool = verifiedJob.application.invocation.tool.tool!!.description
                                    val givenParameters =
                                        verifiedJob.jobInput.asMap().mapNotNull { (paramName, value) ->
                                            if (value != null) {
                                                app.parameters.find { it.name == paramName }!! to value
                                            } else {
                                                null
                                            }
                                        }.toMap()

                                    val command = app.invocation.flatMap { it.buildInvocationList(givenParameters) }

                                    log.debug("Container is: ${tool.container}")
                                    log.debug("Executing command: $command")

                                    withName("user-job")
                                    withImage(tool.container)
                                    withRestartPolicy("Never")
                                    withCommand(command)

                                    withWorkingDir(dataDirectory)

                                    withVolumeMounts(
                                        VolumeMount(localDirectory, null, temporaryStorage, false, null),
                                        VolumeMount(
                                            dataDirectory,
                                            null,
                                            dataStorage,
                                            false,
                                            verifiedJob.workspace?.removePrefix("/") ?: throw RPCException(
                                                "No workspace found",
                                                HttpStatusCode.BadRequest
                                            )
                                        )
                                    )
                                }
                            )

                            withVolumes(
                                volume {
                                    withName(temporaryStorage)
                                    withEmptyDir(EmptyDirVolumeSource())
                                },

                                volume {
                                    withName(dataStorage)
                                    withPersistentVolumeClaim(PersistentVolumeClaimVolumeSource("cephfs", false))
                                }
                            )
                        }
                    }.build()
                )
            }
            .done()

        GlobalScope.launch {
            log.info("Awaiting container start!")
            try {
                awaitCatching(retries = 1200, delay = 100) {
                    val pod = findPod(podName)!!
                    val state = pod.status.containerStatuses.first().state
                    state.running != null || state.terminated != null
                }

                ComputationCallbackDescriptions.requestStateChange.call(
                    StateChangeRequest(
                        verifiedJob.id,
                        JobState.RUNNING,
                        "Your job is now running. You will be able to follow the logs while the job is running."
                    ),
                    serviceClient
                ).orThrow()
            } catch (ex: Throwable) {
                log.warn("Container did not start within deadline!")
                ComputationCallbackDescriptions.requestStateChange.call(
                    StateChangeRequest(verifiedJob.id, JobState.FAILURE, "Job did not start within deadline."),
                    serviceClient
                ).orThrow()
            }
        }
    }

    fun cleanup(requestId: String) {
        val pod = podName(requestId)
        try {
            k8sClient.batch().jobs().inNamespace(namespace).withName(pod).delete()
        } catch (ex: KubernetesClientException) {
            when (ex.status.code) {
                400, 404 -> return
                else -> throw ex
            }
        }
    }

    fun retrieveLogs(requestId: String, startLine: Int, maxLines: Int): Pair<String, Int> {
        return try {
            // This is a stupid implementation that works with the current API. We should be using websockets.
            val jobName = podName(requestId)
            val pod = findPod(jobName) ?: return Pair("", 0)
            val completeLog = k8sClient.pods().inNamespace(namespace).withName(pod.metadata.name).log.lines()
            val lines = completeLog.drop(startLine).take(maxLines)
            val nextLine = startLine + lines.size
            Pair(lines.joinToString("\n"), nextLine)
        } catch (ex: KubernetesClientException) {
            when (ex.status.code) {
                404, 400 -> Pair("", 0)
                else -> throw ex
            }
        }
    }

    companion object : Loggable {
        override val log = logger()
    }
}

data class RemoteProcess(
    val stdout: InputStream?,
    val stderr: InputStream?,
    val stdin: OutputStream?
)

class OutputStreamWithCustomClose(
    private val delegate: OutputStream,
    private val onClose: () -> Unit
) : OutputStream() {
    override fun write(b: Int) {
        delegate.write(b)
    }

    override fun write(b: ByteArray?) {
        delegate.write(b)
    }

    override fun write(b: ByteArray?, off: Int, len: Int) {
        delegate.write(b, off, len)
    }

    override fun flush() {
        delegate.flush()
    }

    override fun close() {
        delegate.close()
        onClose()
    }
}

fun PodResource<Pod, DoneablePod>.execWithDefaultListener(
    command: List<String>,
    attachStdout: Boolean = true,
    attachStderr: Boolean = false,
    attachStdin: Boolean = false
): RemoteProcess {
    // I don't have a clue on how you are supposed to call this API.
    lateinit var watch: ExecWatch

    val latch = CountDownLatch(1)

    var pipeErrIn: InputStream? = null
    var pipeErrOut: OutputStream? = null

    var pipeOutIn: InputStream? = null
    var pipeOutOut: OutputStream? = null

    var pipeInOut: OutputStream? = null

    var execable: PodResource<Pod, DoneablePod> = this
    if (attachStdout) {
        pipeOutOut = PipedOutputStream()
        pipeOutIn = PipedInputStream(pipeOutOut)
        execable = execable.writingOutput(pipeOutOut) as PodOperationsImpl
    }

    if (attachStderr) {
        pipeErrOut = PipedOutputStream()
        pipeErrIn = PipedInputStream(pipeErrOut)
        execable = execable.writingError(pipeErrOut) as PodOperationsImpl
    }

    if (attachStdin) {
        pipeInOut = PipedOutputStream()
        val pipeInIn = PipedInputStream(pipeInOut)
        execable = execable.readingInput(pipeInIn) as PodOperationsImpl
    }

    execable
        .usingListener(object : ExecListener {
            override fun onOpen(response: Response?) {
                println("Open!")
                latch.countDown()
            }

            override fun onFailure(t: Throwable?, response: Response?) {
            }

            override fun onClose(code: Int, reason: String?) {
                println("Closing!")
                pipeErrOut?.close()
                pipeOutOut?.close()
                pipeInOut?.close()
                watch.close()
            }
        })
        .exec(*command.toTypedArray()).also { watch = it }

    latch.await()
    return RemoteProcess(
        pipeOutIn,
        pipeErrIn,
        pipeInOut?.let {
            OutputStreamWithCustomClose(it) {
                // We need to wait for the data to reach the other end. Without this sleep we will close before
                // the data is even sent to the pod.
                Thread.sleep(250)

                // We need to signal the other end that we are done. We do this by closing the watch.
                watch.close()
            }
        }
    )
}


fun PodTemplateSpecBuilder.metadata(builder: ObjectMetaBuilder.() -> Unit): PodTemplateSpecBuilder {
    val objectMetaBuilder = ObjectMetaBuilder()
    objectMetaBuilder.builder()
    withMetadata(objectMetaBuilder.build())
    return this
}

fun DoneableJob.metadata(builder: ObjectMetaBuilder.() -> Unit): DoneableJob {
    val objectMetaBuilder = ObjectMetaBuilder()
    objectMetaBuilder.builder()
    withMetadata(objectMetaBuilder.build())
    return this
}


fun DoneablePod.metadata(builder: ObjectMetaBuilder.() -> Unit): DoneablePod {
    val objectMetaBuilder = ObjectMetaBuilder()
    objectMetaBuilder.builder()
    withMetadata(objectMetaBuilder.build())
    return this
}

fun DoneableJob.spec(builder: JobSpecBuilder.() -> Unit): DoneableJob {
    val podBuilder = JobSpecBuilder()
    podBuilder.builder()
    withSpec(podBuilder.build())
    return this
}

fun PodTemplateSpecBuilder.spec(builder: PodSpecBuilder.() -> Unit): PodTemplateSpecBuilder {
    val podBuilder = PodSpecBuilder()
    podBuilder.builder()
    withSpec(podBuilder.build())
    return this
}

fun DoneablePod.spec(builder: PodSpecBuilder.() -> Unit): DoneablePod {
    val podBuilder = PodSpecBuilder()
    podBuilder.builder()
    withSpec(podBuilder.build())
    return this
}

fun PodSpecBuilder.container(builder: ContainerBuilder.() -> Unit): Container {
    val containerBuilder = ContainerBuilder()
    containerBuilder.builder()
    return containerBuilder.build()
}

fun PodSpecBuilder.volume(builder: VolumeBuilder.() -> Unit): Volume {
    val volumeBuilder = VolumeBuilder()
    volumeBuilder.builder()
    return volumeBuilder.build()
}

fun await(retries: Int = 50, delay: Long = 100, condition: () -> Boolean) {
    for (attempt in 0 until retries) {
        if (condition()) return
        Thread.sleep(delay)
    }

    throw IllegalStateException("Condition failed!")
}

fun awaitCatching(retries: Int = 50, delay: Long = 100, condition: () -> Boolean) {
    for (attempt in 0 until retries) {
        if (runCatching(condition).getOrNull() == true) return
        Thread.sleep(delay)
    }

    throw IllegalStateException("Condition failed!")
}

private fun SimpleDuration.toSeconds(): Long {
    return (hours * 3600L) + (minutes * 60) + seconds
}
