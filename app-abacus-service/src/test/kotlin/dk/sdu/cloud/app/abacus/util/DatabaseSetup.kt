package dk.sdu.cloud.app.abacus.util

import dk.sdu.cloud.service.db.H2_TEST_CONFIG
import dk.sdu.cloud.service.db.HibernateSessionFactory

fun withDatabase(closure: (HibernateSessionFactory) -> Unit) {
    HibernateSessionFactory.create(H2_TEST_CONFIG).use(closure)
}