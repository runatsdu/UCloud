package dk.sdu.cloud.project.repository

import dk.sdu.cloud.micro.*
import dk.sdu.cloud.service.*
import dk.sdu.cloud.project.repository.rpc.*

class Server(override val micro: Micro) : CommonServer {
    override val log = logger()

    override fun start() {
        with(micro.server) {
            configureControllers(
                ProjectRepositoryController()
            )
        }

        startServices()
    }
}