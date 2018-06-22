package dk.sdu.cloud.storage.api

import com.fasterxml.jackson.annotation.JsonIgnore

enum class AccessRight {
    READ,
    WRITE,
    EXECUTE
}

data class AccessEntry(val entity: String, val isGroup: Boolean, val rights: Set<AccessRight>)

enum class FileType {
    FILE,
    DIRECTORY,
    LINK
}

data class StorageFile(
    val type: FileType,
    val path: String,
    val createdAt: Long = System.currentTimeMillis(),
    val modifiedAt: Long = System.currentTimeMillis(),
    val ownerName: String,
    val size: Long = 0,
    val acl: List<AccessEntry> = emptyList(),
    val favorited: Boolean = false,
    val sensitivityLevel: SensitivityLevel = SensitivityLevel.CONFIDENTIAL,
    val link: Boolean = false,
    val annotations: Set<String> = emptySet(),
    @get:JsonIgnore val inode: String = ""
)

enum class SensitivityLevel {
    OPEN_ACCESS,
    CONFIDENTIAL,
    SENSITIVE
}

