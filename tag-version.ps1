#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("frontend", "core", "assistant", "assistant-migrations")]
    [string]$Service,

    [Parameter(Mandatory=$false)]
    [ValidateSet("major", "minor", "patch")]
    [string]$VersionType
)

# Define available services and metadata
$serviceConfig = @{
    frontend = @{
        Prefix = "mucgpt-frontend-"
        PackageUrl = "https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-frontend"
        ManifestPath = [System.IO.Path]::Combine("mucgpt-frontend", "package.json")
        ManifestType = "packageJson"
    }
    core = @{
        Prefix = "mucgpt-core-"
        PackageUrl = "https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-core"
        ManifestPath = [System.IO.Path]::Combine("mucgpt-core-service", "pyproject.toml")
        ManifestType = "pyproject"
    }
    assistant = @{
        Prefix = "mucgpt-assistant-"
        PackageUrl = "https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant"
        ManifestPath = [System.IO.Path]::Combine("mucgpt-assistant-service", "pyproject.toml")
        ManifestType = "pyproject"
    }
    "assistant-migrations" = @{
        Prefix = "mucgpt-assistant-migrations-"
        PackageUrl = "https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant-migrations"
        ManifestPath = [System.IO.Path]::Combine("mucgpt-assistant-service-migrations", "pyproject.toml")
        ManifestType = "pyproject"
    }
}
$availableServices = @($serviceConfig.Keys)

function Read-YesNo {
    param(
        [Parameter(Mandatory=$true)][string]$Prompt
    )

    $options = @("y", "n")

    while ($true) {
        $userInput = Read-Host $Prompt

        if ([string]::IsNullOrWhiteSpace($userInput)) {
            Write-Host "Please enter 'y' or 'n'" -ForegroundColor Red
            continue
        }

        if ($options -contains $userInput) {
            return $userInput
        }

        $matchedOptions = $options | Where-Object { $_ -like "$userInput*" }
        if ($matchedOptions.Count -eq 1) {
            Write-Host "Selected: $($matchedOptions[0])" -ForegroundColor Green
            return $matchedOptions[0]
        }

        Write-Host "Please enter 'y' or 'n'" -ForegroundColor Red
    }
}

function Update-ManifestVersion {
    param(
        [Parameter(Mandatory=$true)][string]$FilePath,
        [Parameter(Mandatory=$true)][string]$ManifestType,
        [Parameter(Mandatory=$true)][string]$NewVersion
    )

    if ($ManifestType -eq "pyproject") {
        $content = Get-Content -Raw -Path $FilePath
        $regex = [regex]::new('(?m)^(?<prefix>\s*version\s*=\s*")[^\"]+(?<suffix>")')

        if (-not $regex.IsMatch($content)) {
            throw "Could not find a version entry in $FilePath"
        }

        $updatedContent = $regex.Replace($content, { param($match) return $match.Groups['prefix'].Value + $NewVersion + $match.Groups['suffix'].Value }, 1)
        Set-Content -Path $FilePath -Value $updatedContent -Encoding UTF8
    }
    elseif ($ManifestType -eq "packageJson") {
        $jsonContent = Get-Content -Raw -Path $FilePath | ConvertFrom-Json
        $jsonContent.version = $NewVersion
        $jsonContent | ConvertTo-Json -Depth 100 | Set-Content -Path $FilePath -Encoding UTF8
    }
    else {
        throw "Unsupported manifest type '$ManifestType'"
    }
}

# Interactive service selection if not provided
if (-not $Service) {
    Write-Host "Available services:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $availableServices.Count; $i++) {
        Write-Host "$($i+1). $($availableServices[$i])" -ForegroundColor Green
    }

    $serviceIndex = $null
    while (-not $serviceIndex -or $serviceIndex -lt 1 -or $serviceIndex -gt $availableServices.Count) {
        $serviceInput = Read-Host "Enter service number (1-$($availableServices.Count)) or start typing for autocomplete"

        # Check if input is a number
        if ($serviceInput -match '^\d+$') {
            $serviceIndex = [int]$serviceInput
            if ($serviceIndex -lt 1 -or $serviceIndex -gt $availableServices.Count) {
                Write-Host "Invalid selection. Please enter a number between 1 and $($availableServices.Count)" -ForegroundColor Red
            }
        } else {
            # Handle autocomplete - find matches
            $matchedOptions = $availableServices | Where-Object { $_ -like "$serviceInput*" }

            if ($matchedOptions.Count -eq 0) {
                Write-Host "No matches found. Please try again." -ForegroundColor Red
            } elseif ($matchedOptions.Count -eq 1) {
                # Exact match found
                $Service = $matchedOptions[0]
                $serviceIndex = $availableServices.IndexOf($Service) + 1
                Write-Host "Selected service: $Service" -ForegroundColor Green
            } else {
                # Multiple matches, show options
                Write-Host "Multiple matches found:" -ForegroundColor Yellow
                for ($i = 0; $i -lt $matchedOptions.Count; $i++) {
                    $idx = $availableServices.IndexOf($matchedOptions[$i]) + 1
                    Write-Host "$idx. $($matchedOptions[$i])" -ForegroundColor Green
                }
            }
        }
    }

    if (-not $Service) {
        $Service = $availableServices[$serviceIndex - 1]
    }

    Write-Host "Selected service: $Service" -ForegroundColor Green
}

# Interactive version type selection if not provided
$versionTypes = @("major", "minor", "patch")
if (-not $VersionType) {
    Write-Host "`nVersion increment type:" -ForegroundColor Cyan
    Write-Host "1. major - Breaking changes" -ForegroundColor Green
    Write-Host "2. minor - New features, backwards compatible" -ForegroundColor Green
    Write-Host "3. patch - Bug fixes, backwards compatible" -ForegroundColor Green

    $versionIndex = $null
    while (-not $versionIndex -or $versionIndex -lt 1 -or $versionIndex -gt 3) {
        $versionInput = Read-Host "Enter version type number (1-3) or start typing for autocomplete"

        # Check if input is a number
        if ($versionInput -match '^\d+$') {
            $versionIndex = [int]$versionInput
            if ($versionIndex -lt 1 -or $versionIndex -gt 3) {
                Write-Host "Invalid selection. Please enter a number between 1 and 3" -ForegroundColor Red
            }
        } else {
            # Handle autocomplete - find matches
            $matchedOptions = $versionTypes | Where-Object { $_ -like "$versionInput*" }

            if ($matchedOptions.Count -eq 0) {
                Write-Host "No matches found. Please try again." -ForegroundColor Red
            } elseif ($matchedOptions.Count -eq 1) {
                # Exact match found
                $VersionType = $matchedOptions[0]
                $versionIndex = $versionTypes.IndexOf($VersionType) + 1
                Write-Host "Selected version type: $VersionType" -ForegroundColor Green
            } else {
                # Multiple matches, show options
                Write-Host "Multiple matches found:" -ForegroundColor Yellow
                for ($i = 0; $i -lt $matchedOptions.Count; $i++) {
                    $idx = $versionTypes.IndexOf($matchedOptions[$i]) + 1
                    Write-Host "$idx. $($matchedOptions[$i])" -ForegroundColor Green
                }
            }
        }
    }

    if (-not $VersionType) {
        $VersionType = $versionTypes[$versionIndex - 1]
    }

    Write-Host "Selected version type: $VersionType" -ForegroundColor Green
}

# Define the prefix based on the service
$prefix = $serviceConfig[$Service].Prefix

# Get all tags that match the prefix
Write-Host "Finding latest version for $Service service..."
Write-Host "Looking for tags with prefix: $prefix" -ForegroundColor Cyan

# Get all tags as an array
$allTags = @(git tag)
# Filter tags that start with the prefix
$tags = @($allTags | Where-Object { $_ -like "$prefix*" })

Write-Host "Found $(if($tags.Count -eq 0){"no"}else{$tags.Count}) matching tags" -ForegroundColor $(if($tags.Count -eq 0){"Yellow"}else{"Green"})

$latestVersion = $null
if ($tags.Count -gt 0) {
    # Parse versions properly to ensure correct sorting
    $versionObjects = @()
    foreach ($tag in $tags) {
        Write-Host "Processing tag: $tag" -ForegroundColor DarkGray
        $versionString = $tag -replace "$prefix", ''
        try {
            $versionParts = $versionString -split '\.'
            if ($versionParts.Count -eq 3) {
                $vObj = New-Object PSObject -Property @{
                    Tag = $tag
                    VersionString = $versionString
                    Major = [int]$versionParts[0]
                    Minor = [int]$versionParts[1]
                    Patch = [int]$versionParts[2]
                }
                $versionObjects += $vObj
                Write-Host "  Parsed as: v$($vObj.Major).$($vObj.Minor).$($vObj.Patch)" -ForegroundColor DarkGray
            } else {
                Write-Host "  Warning: Tag $tag doesn't contain a valid semantic version (need 3 parts)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  Warning: Skipping tag $tag as it doesn't follow semantic versioning format" -ForegroundColor Yellow
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
    }    if ($versionObjects.Count -gt 0) {
        # Sort by Major, Minor, Patch in descending order
        $sortedVersions = $versionObjects | Sort-Object -Property Major,Minor,Patch -Descending

        # Display all found versions for verification
        Write-Host "`nValid versions found for $Service service:" -ForegroundColor Cyan
        foreach ($v in $sortedVersions) {
            Write-Host "  $($v.VersionString) (from tag: $($v.Tag))" -ForegroundColor Green
        }

        # The highest version is always the first one after sorting
        $latestTag = $sortedVersions[0].Tag
        $latestVersion = $sortedVersions[0].VersionString
        Write-Host "`n✅ Highest version found: " -NoNewline -ForegroundColor Green
        Write-Host "$latestVersion" -NoNewline -ForegroundColor White -BackgroundColor DarkGreen
        Write-Host " (from tag: $latestTag)" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ No valid semantic version tags found for $Service service. Starting with version 0.0.0" -ForegroundColor Yellow -BackgroundColor DarkRed
        $latestVersion = "0.0.0"
    }
} else {
    Write-Host "`n⚠️ No existing tags found for $Service service. Starting with version 0.0.0" -ForegroundColor Yellow -BackgroundColor DarkRed
    $latestVersion = "0.0.0"
}

# Parse the version
$versionParts = $latestVersion -split '\.'
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

# Increment the appropriate part
switch ($VersionType) {
    "major" {
        $major++
        $minor = 0
        $patch = 0
    }
    "minor" {
        $minor++
        $patch = 0
    }
    "patch" {
        $patch++
    }
}

$newVersion = "$major.$minor.$patch"
$newTag = "$prefix$newVersion"

# Show what's going to happen and confirm
Write-Host "`n========== VERSION UPDATE SUMMARY ==========" -ForegroundColor Cyan
Write-Host "Service:        $Service" -ForegroundColor Green
Write-Host "Current version: $latestVersion" -ForegroundColor Yellow
Write-Host "New version:     $newVersion" -ForegroundColor Green
Write-Host "New tag:         $newTag" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan

$manifestPath = $null
$manifestType = $null
if ($serviceConfig[$Service].ManifestPath) {
    $manifestPath = Join-Path -Path $PSScriptRoot -ChildPath $serviceConfig[$Service].ManifestPath
    $manifestType = $serviceConfig[$Service].ManifestType
}
$operationSucceeded = $false

$options = @("y", "n")
$confirmation = ""
while ($confirmation -notin $options) {
    $userInput = Read-Host "Do you want to create this tag? (y/n)"

    # Handle empty input
    if ([string]::IsNullOrWhiteSpace($userInput)) {
        Write-Host "Please enter 'y' or 'n'" -ForegroundColor Red
        continue
    }

    # Direct match
    if ($userInput -eq "y" -or $userInput -eq "n") {
        $confirmation = $userInput
        continue
    }

    # Try autocomplete
    $matchedOptions = $options | Where-Object { $_ -like "$userInput*" }

    if ($matchedOptions.Count -eq 1) {
        $confirmation = $matchedOptions[0]
        Write-Host "Selected: $confirmation" -ForegroundColor Green
    } else {
        Write-Host "Please enter 'y' or 'n'" -ForegroundColor Red
    }
}

if ($confirmation -ne "y") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit
}

# Create the tag
$tagCreationOutput = git tag $newTag 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ ERROR CREATING TAG" -ForegroundColor White -BackgroundColor Red
    Write-Host "-------------------------------------" -ForegroundColor Red
    foreach ($line in $tagCreationOutput) {
        Write-Host $line -ForegroundColor Red
    }
    Write-Host "-------------------------------------" -ForegroundColor Red
    if ($manifestPath) {
        Write-Host "Manifest update skipped because tag creation failed." -ForegroundColor Yellow
    }
    exit 1
}

$operationSucceeded = $true
Write-Host "Tag $newTag created locally." -ForegroundColor Green

$pushOptions = @("y", "n")
$pushConfirmation = ""
while ($pushConfirmation -notin $pushOptions) {
    $userInput = Read-Host "Do you want to push this tag to origin? (y/n)"

    # Handle empty input
    if ([string]::IsNullOrWhiteSpace($userInput)) {
        Write-Host "Please enter 'y' or 'n'" -ForegroundColor Red
        continue
    }

    # Direct match
    if ($userInput -eq "y" -or $userInput -eq "n") {
        $pushConfirmation = $userInput
        continue
    }

    # Try autocomplete
    $matchedOptions = $pushOptions | Where-Object { $_ -like "$userInput*" }

    if ($matchedOptions.Count -eq 1) {
        $pushConfirmation = $matchedOptions[0]
        Write-Host "Selected: $pushConfirmation" -ForegroundColor Green
    } else {
        Write-Host "Please enter 'y' or 'n'" -ForegroundColor Red
    }
}

if ($pushConfirmation -eq "y") {
    Write-Host "Pushing tag to origin..." -ForegroundColor Cyan

    # Capture error output
    $errorOutput = $null
    $pushResult = $null

    try {
        # Execute git push and capture output and error
        $pushResult = git push origin $newTag 2>&1
        $pushSuccess = $LASTEXITCODE -eq 0

        if ($pushSuccess) {
            Write-Host "✅ SUCCESS: Tag $newTag pushed to origin." -ForegroundColor Green
            Write-Host "The corresponding workflow should now be triggered." -ForegroundColor Cyan

            # Show relevant link based on service
            $packageUrl = $serviceConfig[$Service].PackageUrl
            if ($packageUrl) {
                Write-Host "You can check the new $Service version at: $packageUrl" -ForegroundColor Cyan
            }
            $operationSucceeded = $true
        } else {
            Write-Host "`n❌ ERROR PUSHING TAG" -ForegroundColor White -BackgroundColor Red
            Write-Host "-------------------------------------" -ForegroundColor Red
            foreach ($line in $pushResult) {
                Write-Host $line -ForegroundColor Red
            }
            Write-Host "-------------------------------------" -ForegroundColor Red
            Write-Host "The tag was created locally but could not be pushed to remote repository." -ForegroundColor Yellow
            Write-Host "Check your internet connection or repository access permissions." -ForegroundColor Yellow
            Write-Host "To push later, use: git push origin $newTag" -ForegroundColor Cyan
            $operationSucceeded = $false
        }
    } catch {
        Write-Host "`n❌ ERROR PUSHING TAG" -ForegroundColor White -BackgroundColor Red
        Write-Host "-------------------------------------" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host "-------------------------------------" -ForegroundColor Red
        Write-Host "The tag was created locally but could not be pushed to remote repository." -ForegroundColor Yellow
        Write-Host "Check your internet connection or repository access permissions." -ForegroundColor Yellow
        Write-Host "To push later, use: git push origin $newTag" -ForegroundColor Cyan
        $operationSucceeded = $false
    }
}else {
    Write-Host "Tag was created locally but not pushed." -ForegroundColor Yellow
    Write-Host "To push later, use: git push origin $newTag" -ForegroundColor Cyan
}

if ($operationSucceeded -and $manifestPath) {
    Write-Host "`nManifest file detected: $manifestPath" -ForegroundColor Cyan

    if (-not (Test-Path $manifestPath)) {
        Write-Host "  ⚠️ Unable to find manifest file. Skipping version file update." -ForegroundColor Yellow
    }
    else {
        $updateManifest = Read-YesNo "Do you want to update this file to version $newVersion? (y/n)"

        if ($updateManifest -eq "y") {
            try {
                Update-ManifestVersion -FilePath $manifestPath -ManifestType $manifestType -NewVersion $newVersion
                Write-Host "Manifest version updated to $newVersion" -ForegroundColor Green
            }
            catch {
                Write-Host "Failed to update manifest version: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        else {
            Write-Host "Manifest file left unchanged." -ForegroundColor Yellow
        }
    }
}
elseif ($manifestPath) {
    Write-Host "`nSkipping manifest update because the tagging workflow did not complete successfully." -ForegroundColor Yellow
}
