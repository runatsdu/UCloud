package dk.sdu.cloud.storage.services

import dk.sdu.cloud.service.stackTraceToString
import dk.sdu.cloud.storage.api.FileType
import dk.sdu.cloud.storage.util.FSException
import org.kamranzafar.jtar.TarEntry
import org.kamranzafar.jtar.TarHeader
import org.kamranzafar.jtar.TarOutputStream
import org.slf4j.LoggerFactory
import java.io.OutputStream
import java.util.zip.GZIPOutputStream

class BulkDownloadService<Ctx : FSUserContext>(
    private val fs: CoreFileSystemService<Ctx>
) {
    fun downloadFiles(ctx: Ctx, prefixPath: String, listOfFiles: List<String>, target: OutputStream) {
        TarOutputStream(GZIPOutputStream(target)).use { tarStream ->
            for (path in listOfFiles) {
                try {
                    // Calculate correct path, check if file exists and filter out bad files
                    val absPath = "${prefixPath.removeSuffix("/")}/${path.removePrefix("/")}"
                    val stat = fs.statOrNull(
                        ctx,
                        absPath,
                        setOf(FileAttribute.PATH, FileAttribute.SIZE, FileAttribute.TIMESTAMPS, FileAttribute.FILE_TYPE)
                    ) ?: continue

                    // Write tar header
                    log.debug("Writing tar header: ($path, $stat)")
                    tarStream.putNextEntry(
                        TarEntry(
                            TarHeader.createHeader(
                                path,
                                stat.size,
                                stat.timestamps.modified,
                                stat.fileType == FileType.DIRECTORY,
                                511 // TODO! (0777)
                            )
                        )
                    )

                    // Write file contents
                    fs.read(ctx, absPath) { copyTo(tarStream) }
                } catch (ex: FSException) {
                    when (ex) {
                        is FSException.NotFound, is FSException.PermissionException -> {
                            log.debug("Skipping file, caused by exception:")
                            log.debug(ex.stackTraceToString())
                        }

                        else -> throw ex
                    }
                }
            }
        }
    }

    companion object {
        private val log = LoggerFactory.getLogger(BulkDownloadService::class.java)
    }
}