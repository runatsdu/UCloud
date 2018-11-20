package dk.sdu.cloud.file.services

import dk.sdu.cloud.file.api.AccessRight
import dk.sdu.cloud.file.api.FileType
import dk.sdu.cloud.file.api.SensitivityLevel
import dk.sdu.cloud.file.api.StorageEvent
import dk.sdu.cloud.file.api.StorageEventProducer
import dk.sdu.cloud.file.api.WriteConflictPolicy
import dk.sdu.cloud.file.api.fileName
import dk.sdu.cloud.file.api.joinPath
import dk.sdu.cloud.file.api.normalize
import dk.sdu.cloud.file.api.relativize
import dk.sdu.cloud.file.util.FSException
import dk.sdu.cloud.file.util.retryWithCatch
import dk.sdu.cloud.file.util.throwExceptionBasedOnStatus
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import java.io.InputStream
import java.io.OutputStream

class CoreFileSystemService<Ctx : FSUserContext>(
    private val fs: LowLevelFileSystemInterface<Ctx>,
    private val eventProducer: StorageEventProducer
) {
    fun write(
        ctx: Ctx,
        path: String,
        conflictPolicy: WriteConflictPolicy,
        writer: OutputStream.() -> Unit
    ) {
        val normalizedPath = path.normalize()
        val targetPath =
            renameAccordingToPolicy(ctx, normalizedPath, conflictPolicy)

        fs.openForWriting(ctx, targetPath, conflictPolicy.allowsOverwrite()).emitAll()
        fs.write(ctx, writer).emitAll()
    }

    fun <R> read(
        ctx: Ctx,
        path: String,
        range: IntRange? = null,
        consumer: InputStream.() -> R
    ): R {
        fs.openForReading(ctx, path).unwrap()
        return fs.read(ctx, range, consumer)
    }

    fun copy(
        ctx: Ctx,
        from: String,
        to: String,
        conflictPolicy: WriteConflictPolicy
    ) {
        val normalizedFrom = from.normalize()
        val fromStat = stat(ctx, from, setOf(FileAttribute.FILE_TYPE))
        if (fromStat.fileType != FileType.DIRECTORY) {
            val targetPath = renameAccordingToPolicy(ctx, to, conflictPolicy)
            fs.copy(ctx, from, targetPath, conflictPolicy.allowsOverwrite()).emitAll()
        } else {
            tree(ctx, from, setOf(FileAttribute.PATH)).forEach { it ->
                val currentPath = it.path

                retryWithCatch(
                    retryDelayInMs = 0L,
                    exceptionFilter = { it is FSException.AlreadyExists },
                    body = {
                        val desired = joinPath(to.normalize(), relativize(normalizedFrom, currentPath))
                        val targetPath = renameAccordingToPolicy(ctx, desired, conflictPolicy)

                        fs.copy(ctx, currentPath, targetPath, conflictPolicy.allowsOverwrite()).emitAll()
                    }
                )
            }
        }
    }

    fun delete(
        ctx: Ctx,
        path: String
    ) {
        fs.delete(ctx, path).emitAll()
    }

    fun stat(
        ctx: Ctx,
        path: String,
        mode: Set<FileAttribute>
    ): FileRow {
        return fs.stat(ctx, path, mode).unwrap()
    }

    fun statOrNull(
        ctx: Ctx,
        path: String,
        mode: Set<FileAttribute>
    ): FileRow? {
        return try {
            stat(ctx, path, mode)
        } catch (ex: FSException.NotFound) {
            null
        }
    }

    fun listDirectory(
        ctx: Ctx,
        path: String,
        mode: Set<FileAttribute>
    ): List<FileRow> {
        return fs.listDirectory(ctx, path, mode).unwrap()
    }

    fun tree(
        ctx: Ctx,
        path: String,
        mode: Set<FileAttribute>
    ): List<FileRow> {
        return fs.tree(ctx, path, mode).unwrap()
    }

    fun makeDirectory(
        ctx: Ctx,
        path: String
    ) {
        fs.makeDirectory(ctx, path).emitAll()

    }

    fun move(
        ctx: Ctx,
        from: String,
        to: String,
        conflictPolicy: WriteConflictPolicy
    ) {
        val targetPath = renameAccordingToPolicy(ctx, to, conflictPolicy)
        fs.move(ctx, from, targetPath, conflictPolicy.allowsOverwrite()).emitAll()
    }

    fun exists(
        ctx: Ctx,
        path: String
    ): Boolean {
        return try {
            stat(ctx, path, setOf(FileAttribute.PATH))
            true
        } catch (ex: FSException.NotFound) {
            false
        }
    }

    fun renameAccordingToPolicy(
        ctx: Ctx,
        desiredTargetPath: String,
        conflictPolicy: WriteConflictPolicy
    ): String {
        if (conflictPolicy == WriteConflictPolicy.OVERWRITE) return desiredTargetPath

        // Performance: This will cause a lot of stats, on items in the same folder, for the most part we could
        // simply ls a common root and cache it. This should be a lot more efficient.
        val targetExists = exists(ctx, desiredTargetPath)
        return when (conflictPolicy) {
            WriteConflictPolicy.OVERWRITE -> desiredTargetPath

            WriteConflictPolicy.RENAME -> {
                if (targetExists) findFreeNameForNewFile(ctx, desiredTargetPath)
                else desiredTargetPath
            }

            WriteConflictPolicy.REJECT -> {
                if (targetExists) throw FSException.AlreadyExists()
                else desiredTargetPath
            }
        }
    }

    fun createSymbolicLink(
        ctx: Ctx,
        targetPath: String,
        linkPath: String
    ): StorageEvent.CreatedOrRefreshed {
        // TODO Automatic renaming... Not a good idea
        val linkRenamedPath = findFreeNameForNewFile(ctx, linkPath)
        val filesCreated = fs.createSymbolicLink(ctx, targetPath, linkRenamedPath).emitAll()
        return filesCreated.single()
    }

    fun chmod(
        ctx: Ctx,
        path: String,
        owner: Set<AccessRight>,
        group: Set<AccessRight>,
        other: Set<AccessRight>,
        recurse: Boolean,
        fileIds: ArrayList<String>? = null
    ) {
        fun applyChmod(path: String): FSResult<List<StorageEvent.CreatedOrRefreshed>> {
            return fs.chmod(ctx, path, owner, group, other)
        }

        if (recurse) {
            fs.tree(ctx, path, setOf(
                FileAttribute.PATH,
                FileAttribute.INODE
            )).unwrap().forEach {
                fileIds?.add(it.inode)
                applyChmod(it.path).emitAll()
            }
        } else {
            fileIds?.add(fs.stat(ctx, path, setOf(FileAttribute.INODE)).unwrap().inode)
            applyChmod(path).emitAll()
        }
    }

    private val duplicateNamingRegex = Regex("""\((\d+)\)""")
    private fun findFreeNameForNewFile(ctx: Ctx, desiredPath: String): String {
        fun findFileNameNoExtension(fileName: String): String {
            return fileName.substringBefore('.')
        }

        fun findExtension(fileName: String): String {
            if (!fileName.contains(".")) return ""
            return '.' + fileName.substringAfter('.', missingDelimiterValue = "")
        }

        val fileName = desiredPath.fileName()
        val desiredWithoutExtension = findFileNameNoExtension(fileName)
        val extension = findExtension(fileName)

        val parentPath = desiredPath.substringBeforeLast('/')
        val names = listDirectory(ctx, parentPath, setOf(FileAttribute.PATH)).map { it.path.fileName() }

        return if (names.isEmpty()) {
            desiredPath
        } else {
            val namesMappedAsIndices = names.mapNotNull {
                val nameWithoutExtension = findFileNameNoExtension(it)
                val nameWithoutPrefix = nameWithoutExtension.substringAfter(desiredWithoutExtension)
                val myExtension = findExtension(it)

                if (extension != myExtension) return@mapNotNull null

                if (nameWithoutPrefix.isEmpty()) {
                    0 // We have an exact match on the file name
                } else {
                    val match = duplicateNamingRegex.matchEntire(nameWithoutPrefix)
                    if (match == null) {
                        null // The file name doesn't match at all, i.e., the file doesn't collide with our desired name
                    } else {
                        match.groupValues.getOrNull(1)?.toIntOrNull()
                    }
                }
            }

            if (namesMappedAsIndices.isEmpty()) {
                desiredPath
            } else {
                val currentMax = namesMappedAsIndices.max() ?: 0
                "$parentPath/$desiredWithoutExtension(${currentMax + 1})$extension"
            }
        }
    }

    private fun <T : StorageEvent> FSResult<List<T>>.emitAll(): List<T> {
        val result = unwrap()
        result.forEach { event ->
            GlobalScope.launch { eventProducer.emit(event) } // TODO BAD IDEA
        }
        return result
    }

    private fun <T> FSResult<T>.unwrap(): T {
        if (statusCode != 0) {
            throwExceptionBasedOnStatus(statusCode)
        } else {
            return value
        }
    }
}
