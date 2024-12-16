# Changelog

All notable changes to this project will be documented in this file.

## [1.10.1] - 2024-12-16

### 🐛 Bug Fixes

- Updated filename parameter for creating signed upload urls

### ⚙️ Miscellaneous Tasks

- Updated resumable uploads to accept presigned urls
- Version bump

## [1.10.0] - 2024-12-16

### 🚀 Features

- Added presigned upload urls

### ⚙️ Miscellaneous Tasks

- Updated resumable uploads to accept presigned urls
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

<!-- generated by git-cliff -->
