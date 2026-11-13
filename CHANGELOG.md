# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 🚀 Features

- `upload.public.folder()` / `upload.private.folder()`: upload a folder file by file, each file a resumable upload into one folder, several at a time and retried on their own. Per-file progress events (`start`, `sent`, `complete`, `retry`, `error`, with the file's `index`), `concurrency`, `retries`, `folderId` to upload into an existing folder, `signal` to cancel, `refreshJwt` to renew a refused JWT. Resolves with the folder's CID and every file's CID; rejects with `FolderUploadError` (`folderId`, `folderName`, `uploaded`, `failed`, `folder`) when files fail for good.

### 🐛 Bug Fixes

- A name or keyvalues given in an upload method's options is no longer dropped by the builder; the caller's options object is no longer modified.
- Resumable uploads follow `Retry-After`, fail at once on a 4xx that a retry can't change, and continue from the offset the server holds after a failed chunk.
- Checks of an upload's registration, and of where it stands after a failed chunk, follow the `Retry-After` the server sends with a 429 or 503.
- A file held in memory as a large part followed by a few small ones (`new File([largeBuffer, smallBuffer])`) is cut with `slice()` instead of being copied part by part from its stream.
- A resumable upload of a File holding more bytes than its size reports (a part from `fs.openAsBlob()` past 4 GiB, which Node reports modulo 2^32) is refused before any byte is sent, wherever that part is in the File, instead of completing cut short.

## [2.4.8] - 2025-06-11

### 🐛 Bug Fixes

- Fixed steamable property
- Small fixes to uploadFile.ts

## [2.4.7] - 2025-06-11

### ⚙️ Miscellaneous Tasks

- Update changelog
- Added new example playground
- Small import refactor
- Update lock file
- Updated src exports

## [2.4.6] - 2025-06-10

### 🐛 Bug Fixes

- Fixed error handling in file.ts

### ⚙️ Miscellaneous Tasks

- Updated changelog
- Version bump
- Updated default chunk size for TUS uploads
- Version bump

## [2.4.4] - 2025-06-03

### ⚙️ Miscellaneous Tasks

- Updated changelog
- Updated to use retry mechanism
- Fixed duplicate variable and used upload-cid header for getting file info
- Update test workflow
- Updated tests
- Version bump

## [2.4.3] - 2025-05-27

### ⚙️ Miscellaneous Tasks

- Updated changelog
- Added no-store for creating signed urls
- Version bump

## [2.4.2] - 2025-05-26

### ⚙️ Miscellaneous Tasks

- Updated changelog
- Updated peerDependenciesMeta and version bump

## [2.4.1] - 2025-05-25

### ⚙️ Miscellaneous Tasks

- Removed extra react dependency
- Version bump and update lock file

## [2.4.0] - 2025-05-22

### 🚀 Features

- Added react subpackage

### ⚙️ Miscellaneous Tasks

- Updated examples to use react subpackage
- Ran formatting
- Version bump
- Updated changelog

## [2.3.0] - 2025-05-13

### 🚀 Features

- Added streamable properties for uploads

### ⚙️ Miscellaneous Tasks

- Updated changelog
- Version bump

## [2.2.2] - 2025-05-05

### 🐛 Bug Fixes

- Fixed type for pin queue response
- Fixed issue with class using rows in filter pin queue

### ⚙️ Miscellaneous Tasks

- Version bump

## [2.2.1] - 2025-04-22

### ⚙️ Miscellaneous Tasks

- Update changelog
- Adds temporary config option for legacy upload endpoint
- Removed dependencies
- Version bump
- Updated changelog

## [2.2.0] - 2025-04-03

### 🚀 Features

- Added maxFileSize and mimeTypes restrictions to createSignedUploadURL
- Add new key resources

### ⚙️ Miscellaneous Tasks

- Refactored to pnpm workspace and added fresh examples
- Version bump

## [2.1.3] - 2025-03-28

### 🐛 Bug Fixes

- Missed one of the File object type replacements

### ⚙️ Miscellaneous Tasks

- Updated changelog
- Version bump

## [2.1.2] - 2025-03-28

### 🐛 Bug Fixes

- Changed accepted file from FileObject to just File

### ⚙️ Miscellaneous Tasks

- Update readme
- Version bump

## [2.1.1] - 2025-03-27

### 🐛 Bug Fixes

- Added network param to getCid() in vectorizeQuery()

### ⚙️ Miscellaneous Tasks

- Update changelog
- Added backfilled status to pin by CID queue
- Version bump

## [2.1.0] - 2025-03-17

### 🚀 Features

- Added method for deleting pin by CID requests

### ⚙️ Miscellaneous Tasks

- Package.json fix
- Update README
- Updated cid.ts with new endpoint and response
- Dependency cleanup
- Updated pin by cid queue method
- Updated pin by CID requests
- Updated path for convertToDesiredGateway
- Updated types for pin by cid response
- Updated unit tests
- Version bump

## [2.0.1] - 2025-03-06

### ⚙️ Miscellaneous Tasks

- Version bump
- Version bump

## [2.0.0] - 2025-03-06

### 🚀 Features

- Added IPFS gateway retrieval and updated classes
- Added get file by id
- Add react example
- Added pin by cid

### 🐛 Bug Fixes

- Updated metadata param to keyvalues

### ⚙️ Miscellaneous Tasks

- Updated changelog
- Refacted next app to use signed urls for uploads
- Refactored to use barrel files
- Refactored list files
- Updated delete files
- Refactored files.update
- Started work on refactoring groups, updated listGroups
- Refactored creating groups"
- Refactored get group by id
- Refactored add files to group"
- Refactored removing files froup groups
- Refactored update group
- Refactored delete group
- Refactored uploads to public and private
- Removed /ipfs path
- Refactored signatures
- Removed private signatures
- Refactored signed url link
- Refactored swaps
- Small detail changes for upload file
- Added file array support
- Added filearray upload to private class
- Refactored error handling
- Testing error handling
- Removed is-ipfs dependency
- Updated tests
- Refactored createSignedURL to createAccessLink
- Updated next starter
- Updated react example
- Updated formatting
- Update github action
- Update github action node version
- Updated upload response type
- Updated tests, fixed export for uploads
- Added queue
- Removed jsdoc
- Added minimum node version requirement
- Added release workflow
- Updated format config export
- Added formatting
- Removed vectors from public files
- Updated folder uploads
- Updated addMetadata to just name and keyvalues
- Updated tests
- Update AI Docs

## [1.10.1] - 2024-12-16

### 🚀 Features

- Added presigned upload urls

### 🐛 Bug Fixes

- Updated filename parameter for creating signed upload urls

### ⚙️ Miscellaneous Tasks

- Updated resumable uploads to accept presigned urls
- Version bump
- Updated changelog
- Version bump

## [1.9.1] - 2024-12-06

### ⚙️ Miscellaneous Tasks

- Fixed build

## [1.9.0] - 2024-12-06

### 🚀 Features

- Added vectors to upload.file
- Added vectors to all upload methods
- Added vectorizeFile
- Added vector query
- Added file vector methods to sdk class
- Added delete file vectors

### 🐛 Bug Fixes

- Updated resumable file upload to use jwt var instead of secret

### ⚙️ Miscellaneous Tasks

- Removed old comments
- Refactored source header in vectorizeFile
- Updated response after vectorization
- Renamed queryVector to queryVectors
- Refactored vectors to use uploadUrl and include returnFile for queries
- Version bump

## [1.8.0] - 2024-11-16

### 🚀 Features

- Added resumable uploads back in
- Added `Analytics` class

### ⚙️ Miscellaneous Tasks

- Small refactor and naming
- Updated structure and approach for analytics

## [1.7.2] - 2024-10-25

### 🐛 Bug Fixes

- Removed line of code that was wiping headers after settingthem

## [1.7.1] - 2024-10-24

### 🐛 Bug Fixes

- Sliced charset from content type header

### ⚙️ Miscellaneous Tasks

- Removed logs

## [1.7.0] - 2024-10-22

### 🚀 Features

- Added methods for adding and removing files to/from groups

### 🐛 Bug Fixes

- Added file chunking

### ⚙️ Miscellaneous Tasks

- Renamed add to addFiles, remove to removeFiles

## [1.6.0] - 2024-10-21

### 🚀 Features

- Added keyvalues to uploads
- Started initial work on resumable uploads

### 🐛 Bug Fixes

- Updated metadata type to only include Record<string | string>
- Fixed keyvalue references
- Updated keyvalue reference in file.ts
- Added missing body and logging

### ⚙️ Miscellaneous Tasks

- Updated unit tests for uploads
- Updated keyvalue case
- Added option for no group in listing files
- Refactored headers

## [1.5.0] - 2024-10-04

### 🚀 Features

- Added metadata key/values to files.list and files.update
- Added new setNewJwt method to SDK class

### ⚙️ Miscellaneous Tasks

- Refactor unit tests
- Update package-lock.json
- Updated next version
- Version bump

## [1.4.1] - 2024-09-24

### 🐛 Bug Fixes

- Add custom header options to gateway methods
- Updated delete file source header

## [1.4.0] - 2024-09-23

### 🚀 Features

- Added optional param of gateway to createSignedURL

## [1.3.0] - 2024-09-20

### 🚀 Features

- Added hot swap methods to Files class

## [1.2.0] - 2024-09-12

### 🚀 Features

- Added new query methods to listing files
- Added image opts to gateways.get()
- Implemented optimizeImage method to get and createdSignedURL
- Add name query to list groups

### ⚙️ Miscellaneous Tasks

- Updated unit tests
- Update unit tests

## [1.1.0] - 2024-09-06

### 🚀 Features

- Add pageToken method
- Added page token to groups

### ⚙️ Miscellaneous Tasks

- Refactor upload response based on new API response
- Updated types for upload response and group_idf

## [1.0.5] - 2024-09-03

### 🐛 Bug Fixes

- Updated postinstall script, bumped version

## [1.0.4] - 2024-09-03

### 🐛 Bug Fixes

- Added config endpoint url that was missing before
- Updated postinstall script

## [1.0.2] - 2024-09-03

### 🚀 Features

- Added custom uploadurl endpoint option

### 🐛 Bug Fixes

- Update package.json

## [1.0.1] - 2024-09-03

### 🐛 Bug Fixes

- Package.json

## [1.0.0] - 2024-09-03

### 🚀 Features

- Added new files API to uploads
- Updated delete method and added files class
- Added list to files class
- Added update to files class
- Added Groups to new API
- Added new API to gateways class and added new createSignedURL method
- Added update and delete group methods
- Added postinstall script

### 🐛 Bug Fixes

- Fixed formatting
- Fixed more formatting

### ⚙️ Miscellaneous Tasks

- Updated readme
- Cleaned up shelved methods
- Updated base64 method
- Removed unnecessary includesCount query
- Updated file naming method for uploads
- Updated syntax and return types
- Refactor UpdateGroupOptions
- Refactor update file
- Cleaned up some code types and methods
- Refactored Next template
- Refactored keys
- Refactored Next.js template
- Updated image in README
- Updated endpoints to prod
- Small changes to example
- Update readme
- Refactored all unit tests

## [0.4.0] - 2024-08-22

### 🚀 Features

- Added optional prefix to convertToDesiredGateway
- Added `containsCID` method to Gateways class
- Add optmizeImage method to gateways.get

### 🐛 Bug Fixes

- Updated the response of `groups.list` from `any` to `GroupResponseItem[]`

### ⚙️ Miscellaneous Tasks

- Updated convertIPFSUrl unit test to reflect updated IPFS Gateway tools

## [0.3.4] - 2024-08-20

### ⚙️ Miscellaneous Tasks

- Refactored error handling
- Updated unit tests

## [0.3.3] - 2024-08-19

### ⚙️ Miscellaneous Tasks

- Updated all files to allow undefined jwt and adjusted unit tests

## [0.3.2] - 2024-08-19

### 🐛 Bug Fixes

- Removed Source header to fix CORS error

## [0.3.1] - 2024-08-19

### 🐛 Bug Fixes

- Build issue

## [0.3.0] - 2024-08-16

### ⚙️ Miscellaneous Tasks

- Added examples repo with Next.js setup

## [0.2.0] - 2024-08-16

### 🚀 Features

- Added ability to pass in custom endpoint
- Added Top Gateway Usage, started Date Interval Usage
- Finished adding date interval method for gateway analytics
- Added small changes to syntax, unit tests, and jsdocs

### 🐛 Bug Fixes

- Issue with file.name being undefined
- Removed some unused code and updated name for source header
- Updated source header in unit test

### 🚜 Refactor

- Changed how custom headers are handled, added new `setNewHeaders` method to change the instance

## [0.1.0] - 2024-07-29

<!-- generated by git-cliff -->
