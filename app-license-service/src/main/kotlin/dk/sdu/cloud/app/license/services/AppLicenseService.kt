package dk.sdu.cloud.app.license.services

import dk.sdu.cloud.AccessRight
import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.app.license.api.*
import dk.sdu.cloud.app.license.services.acl.AclService
import dk.sdu.cloud.app.license.services.acl.UserEntity
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.service.db.DBSessionFactory
import dk.sdu.cloud.service.db.withTransaction
import io.ktor.http.HttpStatusCode
import dk.sdu.cloud.calls.server.CallHandler
import java.util.*

class AppLicenseService<Session>(
    private val db: DBSessionFactory<Session>,
    private val aclService: AclService<*>,
    private val appLicenseDao: AppLicenseDao<Session>
) {
    fun getLicenseServer(licenseId: String, entity: UserEntity) : LicenseServerEntity {
        if (aclService.hasPermission(licenseId, entity, AccessRight.READ)) {
            val licenseServer = db.withTransaction {
                appLicenseDao.getById(it, licenseId)
            }

            if (licenseServer == null) {
                throw RPCException.fromStatusCode(HttpStatusCode.NotFound)
            } else {
                return licenseServer
            }
        }
        throw RPCException.fromStatusCode(HttpStatusCode.Unauthorized)
    }

    fun updateAcl(request: UpdateAclRequest, entity: UserEntity) {
        if (aclService.hasPermission(request.licenseId, entity, AccessRight.READ_WRITE)) {
            request.changes.forEach { change ->
                if (change.revoke) {
                    aclService.revokePermission(request.licenseId, change.entity)
                } else {
                    aclService.updatePermissions(request.licenseId, change.entity, change.rights)
                }
            }
        } else {
            throw RPCException.fromStatusCode(HttpStatusCode.Unauthorized)
        }
    }

    fun listServers(application: Application, entity: UserEntity) : List<ApplicationLicenseServer> {
        return db.withTransaction {session ->
            appLicenseDao.list(
                session,
                application,
                entity
            )?.map { it.toModel() }.orEmpty()
        }
    }

    fun createLicenseServer(request: NewServerRequest, entity: UserEntity): String {
        val serverId = UUID.randomUUID().toString()

        // Add rw permissions for the creator
        aclService.updatePermissions(serverId, entity, AccessRight.READ_WRITE)

        db.withTransaction { session ->
            appLicenseDao.create(
                session,
                serverId,
                ApplicationLicenseServer(
                    request.name,
                    request.version,
                    request.address,
                    request.port,
                    request.license
                )
            )

            request.applications?.forEach {app ->
                // Add applications to the license server
                appLicenseDao.addApplicationToServer(session, app, serverId)
            }
        }
        return serverId
    }

    fun updateLicenseServer(request: UpdateServerRequest, entity: UserEntity): String {
        if (aclService.hasPermission(request.withId, entity, AccessRight.READ_WRITE)) {
            // Save information for existing license server
            db.withTransaction {
                appLicenseDao.save(
                    it,
                    ApplicationLicenseServer(
                        request.name,
                        request.version,
                        request.address,
                        request.port,
                        request.license
                    ),
                    request.withId
                )
            }

            return request.withId
        } else {
            throw RPCException.fromStatusCode(HttpStatusCode.Unauthorized)
        }
    }

    fun addApplicationsToServer(request: AddApplicationsToServerRequest, entity: UserEntity) {
        if (aclService.hasPermission(request.serverId, entity, AccessRight.READ_WRITE)) {
            db.withTransaction {
                request.applications.forEach { app ->
                    appLicenseDao.addApplicationToServer(it, app, request.serverId)
                }
            }
        } else {
            throw RPCException.fromStatusCode(HttpStatusCode.Unauthorized)
        }
    }
}