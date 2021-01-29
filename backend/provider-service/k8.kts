//DEPS dk.sdu.cloud:k8-resources:0.1.2
package dk.sdu.cloud.k8

bundle {
    name = "provider"
    version = "0.1.0"
    
    withAmbassador() {}
    
    val deployment = withDeployment {
        deploy.spec.replicas = 2
    }
    
    withPostgresMigration(deployment)
}