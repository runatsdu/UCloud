package dk.sdu.cloud.app.kubernetes.watcher.services

import dk.sdu.cloud.app.kubernetes.watcher.api.JobCondition
import dk.sdu.cloud.app.kubernetes.watcher.api.JobEvent
import dk.sdu.cloud.app.kubernetes.watcher.api.JobEvents
import dk.sdu.cloud.events.EventStreamService
import dk.sdu.cloud.micro.BackgroundScope
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.service.Time
import io.fabric8.kubernetes.api.model.batch.Job
import io.fabric8.kubernetes.client.KubernetesClient
import io.fabric8.kubernetes.client.KubernetesClientException
import io.fabric8.kubernetes.client.Watch
import io.fabric8.kubernetes.client.Watcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

const val ROLE_LABEL = "role"

class JobWatcher(
    private val k8sClient: KubernetesClient,
    eventStreamService: EventStreamService,
    private val backgroundScope: BackgroundScope,

    private val appRole: String = "sducloud-app",
    private val namespace: String = "app-kubernetes"
) {
    private val producer = eventStreamService.createProducer(JobEvents.events)
    private var currentWatch: Watch? = null

    fun startWatch() {
        currentWatch?.close()
        currentWatch = null

        ourJobs().list().items.forEach {
            handleJobEvent(it)
        }

        currentWatch = ourJobs().watch(object : Watcher<Job> {
            override fun onClose(cause: KubernetesClientException?) {
                // Do nothing
            }

            override fun eventReceived(action: Watcher.Action, resource: Job) {
                handleJobEvent(resource)
            }
        })

        backgroundScope.launch {
            // It seems like we sometimes miss updates from Kubernetes. This small event loop should take care of any
            // events we might miss. This results in slightly slower update times but at least we catch all the events
            // that fall through the cracks.

            var nextScan = Time.now()
            while (isActive) {
                if (Time.now() >= nextScan) {
                    val list = ourJobs().list()
                    log.debug("Scan found ${list.items.size} jobs")
                    list.items.forEach {
                        handleJobEvent(it)
                    }

                    nextScan = Time.now() + 60_000
                }

                delay(1000)
            }
        }
    }

    private fun ourJobs() = k8sClient.batch().jobs().inNamespace(namespace).withLabel(ROLE_LABEL, appRole)

    private fun handleJobEvent(job: Job): Unit = runBlocking {
        val jobName = job.metadata.name
        val condition = job.status?.conditions?.firstOrNull()?.let { cond ->
            JobCondition(
                cond.type,
                cond.reason,
                isActive = job.status.active != null && job.status.active != 0,
                isFailed = job.status.failed != null && job.status.failed != 0
            )
        }

        log.info("Handling event: $jobName $condition")
        producer.produce(JobEvent(jobName, condition))
    }

    companion object : Loggable {
        override val log = logger()
    }
}
