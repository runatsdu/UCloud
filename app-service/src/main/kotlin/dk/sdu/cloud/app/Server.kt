package dk.sdu.cloud.app

import com.fasterxml.jackson.module.kotlin.readValue
import dk.sdu.cloud.app.api.AccountingEvents
import dk.sdu.cloud.app.api.ApplicationDescription
import dk.sdu.cloud.app.api.ToolDescription
import dk.sdu.cloud.app.http.AppController
import dk.sdu.cloud.app.http.CallbackController
import dk.sdu.cloud.app.http.JobController
import dk.sdu.cloud.app.http.ToolController
import dk.sdu.cloud.app.services.*
import dk.sdu.cloud.app.util.yamlMapper
import dk.sdu.cloud.auth.api.authenticator
import dk.sdu.cloud.calls.client.OutgoingHttpCall
import dk.sdu.cloud.micro.*
import dk.sdu.cloud.service.*
import dk.sdu.cloud.service.db.withTransaction
import kotlinx.coroutines.runBlocking
import org.slf4j.Logger
import java.io.File

class Server(
    private val config: Configuration,
    override val micro: Micro
) : CommonServer {
    private var initialized = false
    override val log: Logger = logger()

    override fun start() {
        if (initialized) throw IllegalStateException("Already started!")

        val streams = micro.eventStreamService
        val db = micro.hibernateDatabase
        val serviceClient = micro.authenticator.authenticateClient(OutgoingHttpCall)

        OrchestrationScope.init()

        val toolDao = ToolHibernateDAO()
        val applicationDao = ApplicationHibernateDAO(toolDao)

        val computationBackendService = ComputationBackendService(config.backends, micro.developmentModeEnabled)
        val jobDao = JobHibernateDao(applicationDao, toolDao)
        val jobVerificationService = JobVerificationService(db, applicationDao, toolDao)
        val jobFileService = JobFileService(serviceClient)

        val jobOrchestrator = JobOrchestrator(
            serviceClient,
            streams.createProducer(AccountingEvents.jobCompleted),
            db,
            jobVerificationService,
            computationBackendService,
            jobFileService,
            jobDao
        )

        if (micro.commandLineArguments.contains("--scan")) {
            runBlocking {
                jobOrchestrator.removeExpiredJobs()
            }
            return
        }

        with(micro.server) {
            log.info("Configuring HTTP server")
            configureControllers(
                AppController(
                    db,
                    applicationDao,
                    toolDao
                ),

                JobController(db, jobOrchestrator, jobDao, micro.tokenValidation as TokenValidationJWT, serviceClient),

                CallbackController(jobOrchestrator),

                ToolController(
                    db,
                    toolDao
                )
            )
            log.info("HTTP server successfully configured!")
        }

        if (micro.developmentModeEnabled) {
            val listOfApps = db.withTransaction {
                applicationDao.listLatestVersion(it, null, NormalizedPaginationRequest(null, null))
            }

            if (listOfApps.itemsInTotal == 0) {
                db.withTransaction { session ->
                    val tools = File("yaml", "tools")
                    tools.listFiles().forEach {
                        try {
                            val description = yamlMapper.readValue<ToolDescription>(it)
                            toolDao.create(session, "admin@dev", description.normalize())
                        } catch (ex: Exception) {
                            log.info("Could not create tool: $it")
                            log.info(ex.stackTraceToString())
                        }
                    }

                    val apps = File("yaml", "apps")
                    apps.listFiles().forEach {
                        try {
                            val description = yamlMapper.readValue<ApplicationDescription>(it)
                            applicationDao.create(session, "admin@dev", description.normalize())
                        } catch (ex: Exception) {
                            log.info("Could not create app: $it")
                            log.info(ex.stackTraceToString())
                        }
                    }
                }
            }
        }

        log.info("Starting Application Services")
        startServices()

        initialized = true
    }

    override fun stop() {
        super.stop()
        OrchestrationScope.stop()
    }
}
