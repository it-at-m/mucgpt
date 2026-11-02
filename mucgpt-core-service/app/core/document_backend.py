from deepagents.backends import StoreBackend
from deepagents.backends.protocol import (
    DeleteResult,
    EditResult,
    FileUploadResponse,
    WriteResult,
)


class DocumentBackend(StoreBackend):
    """Close the permission glob's dot-path write gap on the agent mount.

    Reuse StoreBackend reads/searches. All mutations fail at the backend too,
    including direct uploads and middleware writes outside filesystem tools.
    """

    def write(self, file_path: str, content: str) -> WriteResult:
        return WriteResult(error="permission denied: documents are read-only")

    async def awrite(self, file_path: str, content: str) -> WriteResult:
        return self.write(file_path, content)

    def edit(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> EditResult:
        return EditResult(error="permission denied: documents are read-only")

    async def aedit(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> EditResult:
        return self.edit(file_path, old_string, new_string, replace_all)

    def delete(self, file_path: str) -> DeleteResult:
        return DeleteResult(error="permission denied: documents are read-only")

    async def adelete(self, file_path: str) -> DeleteResult:
        return self.delete(file_path)

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        return [
            FileUploadResponse(path=path, error="permission_denied")
            for path, _content in files
        ]

    async def aupload_files(
        self, files: list[tuple[str, bytes]]
    ) -> list[FileUploadResponse]:
        return self.upload_files(files)
