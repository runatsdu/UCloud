package sduclouddb.entities

import org.jetbrains.exposed.dao.EntityID
import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.IntIdTable

object Irodsruleexectype : IntIdTable() {
    val created_ts = datetime("created_ts")
    val modified_ts = datetime("modified_ts")
    val irodsruleexectypename = text("irodsruleexectypename").nullable()
    val irodsruleexectypeidmap = integer("irodsruleexectypeidmap").nullable()
    val active = integer("active").nullable()
}
class IrodsruleexectypeEntity(id: EntityID<Int>) : IntEntity(id) {
    companion object: IntEntityClass<IrodsruleexectypeEntity>(Irodsruleexectype)

    var created_ts by Irodsruleexectype.created_ts
    var modified_ts by Irodsruleexectype.modified_ts
    var irodsruleexectypename by Irodsruleexectype.irodsruleexectypename
    var irodsruleexectypeidmap by Irodsruleexectype.irodsruleexectypeidmap
    var active by Irodsruleexectype.active
}