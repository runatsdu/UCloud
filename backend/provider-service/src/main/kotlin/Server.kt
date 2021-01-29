package dk.sdu.cloud.provider 

import dk.sdu.cloud.micro.Micro
import dk.sdu.cloud.micro.server
import dk.sdu.cloud.provider.rpc.Docs
import dk.sdu.cloud.service.CommonServer
import dk.sdu.cloud.service.configureControllers
import dk.sdu.cloud.service.startServices

class Server(override val micro: Micro) : CommonServer {
    override val log = logger()
    
    override fun start() {
        with(micro.server) {
            configureControllers(Docs())
        }
        
        startServices()
    }
}