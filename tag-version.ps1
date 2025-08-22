#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("frontend", "core", "assistant", "assistant-migrations")]
    [string]$Service,

    [Parameter(Mandatory=$false)]
    [ValidateSet("major", "minor", "patch")]
    [string]$VersionType
)

# Define available services
$availableServices = @("frontend", "core", "assistant", "assistant-migrations")

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
            $matches = $availableServices | Where-Object { $_ -like "$serviceInput*" }

            if ($matches.Count -eq 0) {
                Write-Host "No matches found. Please try again." -ForegroundColor Red
            } elseif ($matches.Count -eq 1) {
                # Exact match found
                $Service = $matches[0]
                $serviceIndex = $availableServices.IndexOf($Service) + 1
                Write-Host "Selected service: $Service" -ForegroundColor Green
            } else {
                # Multiple matches, show options
                Write-Host "Multiple matches found:" -ForegroundColor Yellow
                for ($i = 0; $i -lt $matches.Count; $i++) {
                    $idx = $availableServices.IndexOf($matches[$i]) + 1
                    Write-Host "$idx. $($matches[$i])" -ForegroundColor Green
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
            $matches = $versionTypes | Where-Object { $_ -like "$versionInput*" }

            if ($matches.Count -eq 0) {
                Write-Host "No matches found. Please try again." -ForegroundColor Red
            } elseif ($matches.Count -eq 1) {
                # Exact match found
                $VersionType = $matches[0]
                $versionIndex = $versionTypes.IndexOf($VersionType) + 1
                Write-Host "Selected version type: $VersionType" -ForegroundColor Green
            } else {
                # Multiple matches, show options
                Write-Host "Multiple matches found:" -ForegroundColor Yellow
                for ($i = 0; $i -lt $matches.Count; $i++) {
                    $idx = $versionTypes.IndexOf($matches[$i]) + 1
                    Write-Host "$idx. $($matches[$i])" -ForegroundColor Green
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
$prefix = "mucgpt-$Service-"

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

$options = @("y", "n")
$confirmation = ""
while ($confirmation -notin $options) {
    $input = Read-Host "Do you want to create this tag? (y/n)"

    # Handle empty input
    if ([string]::IsNullOrWhiteSpace($input)) {
        Write-Host "Please enter 'y' or 'n'" -ForegroundColor Red
        continue
    }

    # Direct match
    if ($input -eq "y" -or $input -eq "n") {
        $confirmation = $input
        continue
    }

    # Try autocomplete
    $matches = $options | Where-Object { $_ -like "$input*" }

    if ($matches.Count -eq 1) {
        $confirmation = $matches[0]
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
git tag $newTag
Write-Host "Tag $newTag created locally." -ForegroundColor Green

$pushOptions = @("y", "n")
$pushConfirmation = ""
while ($pushConfirmation -notin $pushOptions) {
    $input = Read-Host "Do you want to push this tag to origin? (y/n)"

    # Handle empty input
    if ([string]::IsNullOrWhiteSpace($input)) {
        Write-Host "Please enter 'y' or 'n'" -ForegroundColor Red
        continue
    }

    # Direct match
    if ($input -eq "y" -or $input -eq "n") {
        $pushConfirmation = $input
        continue
    }

    # Try autocomplete
    $matches = $pushOptions | Where-Object { $_ -like "$input*" }

    if ($matches.Count -eq 1) {
        $pushConfirmation = $matches[0]
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
            switch ($Service) {
                "frontend" {
                    Write-Host "You can check the new frontend version at: https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-frontend" -ForegroundColor Cyan
                }
                "core" {
                    Write-Host "You can check the new core version at: https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-core" -ForegroundColor Cyan
                }
                "assistant" {
                    Write-Host "You can check the new assistant version at: https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant" -ForegroundColor Cyan
                }
                "assistant-migrations" {
                    Write-Host "You can check the new migrations version at: https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant-migrations" -ForegroundColor Cyan
                }
            }
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
        }
    } catch {
        Write-Host "`n❌ ERROR PUSHING TAG" -ForegroundColor White -BackgroundColor Red
        Write-Host "-------------------------------------" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host "-------------------------------------" -ForegroundColor Red
        Write-Host "The tag was created locally but could not be pushed to remote repository." -ForegroundColor Yellow
        Write-Host "Check your internet connection or repository access permissions." -ForegroundColor Yellow
        Write-Host "To push later, use: git push origin $newTag" -ForegroundColor Cyan
    }
}else {
    Write-Host "Tag was created locally but not pushed." -ForegroundColor Yellow
    Write-Host "To push later, use: git push origin $newTag" -ForegroundColor Cyan
}
