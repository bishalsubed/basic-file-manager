import fs from "fs/promises"
import os from "os"
import path from "path";
import { fileURLToPath } from "url";
import { linuxProtectedPaths } from "./utils/folderProtection.js"

const c = {
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    reset: "\x1b[0m"
};

let categories = {
    Images: [],
    Videos: [],
    Music: [],
    Documents: [],
    Spreadsheets: [],
    Presentations: [],
    Archives: [],
    Code: [],
    Configuration: [],
    Applications: [],
    Disk_Images: [],
    Torrents: [],
    Fonts: [],
    Other: [],
    No_Extension: []
}

async function doesPathExists(sourcePath) {
    try {
        await fs.access(sourcePath, fs.constants.F_OK)
        return true
    } catch (error) {
        return false;
    }
}

async function moveFile(src, dest) {
    try {
        await fs.rename(src, dest);
    } catch (error) {
        if (error.code == "EXDEV") {
            try {
                await fs.copyFile(src, dest);
                await fs.unlink(src)
            } catch (error) {
                throw error;
            }
        }
    }

}

async function getFilesFromDir(files = [], pathUrl) {
    try {
        let founds = await fs.readdir(pathUrl)
        for (const found of founds) {
            let filePath = path.join(pathUrl, found)
            let dirStatus = (await fs.stat(filePath)).isDirectory();
            if (dirStatus) {
                await getFilesFromDir(files, path.join(filePath))
            } else {
                files.push(filePath)
            }
        }
        return files
    } catch (error) {
        console.log("Error when executing getFilesFromDir", error);
    }
}

function findFileCategory(fileName) {
    let fileCatgory = configuration.fileNameRules[fileName] ??
        configuration.rules[path.extname(fileName).toLowerCase()] ??
        configuration.defaultCategory;

    return fileCatgory
}

async function rmFolder(deletePath) {
    try {
        await fs.rm(deletePath, { recursive: true, force: true })
    } catch (error) {
        console.error('Error deleting folder:', err);
        return false;
    }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
let configFile = path.join(__dirname, "config.json");

const configData = await fs.readFile(configFile, "utf-8")
const configuration = JSON.parse(configData)

let flags = process.argv
let folderPath = flags[2]
let homeDir = os.homedir()


async function start(sourcePath) {
    if (sourcePath == path.parse(process.cwd()).root || sourcePath == homeDir || sourcePath == path.join(homeDir, "/")) {
        console.log(`${c.red}Unable to work on this path${c.reset}`)
        process.exit(1);
    }
    for (let i = 0; i < linuxProtectedPaths.length; i++) {
        if (sourcePath == linuxProtectedPaths[i] || sourcePath.startsWith(linuxProtectedPaths[i])) {
            console.log(`${c.red}Unable to work on this path${c.reset}`)
            process.exit(1);
        }
    }
    let pathExistence = await doesPathExists(sourcePath);
    if (!pathExistence) {
        console.log(`${c.red}Unable to access the path${c.reset}`)
        process.exit(1)
    }


    let contents = await fs.readdir(sourcePath)
    for (let i = 0; i < contents.length; i++) {
        if (!configuration.ignore.includes(contents[i])) {
            let fileCatgory = findFileCategory(contents[i])
            if (fileCatgory == "Other" && !path.extname(contents[i])) {
                let itsPath = path.join(sourcePath, contents[i])
                let stat = await fs.stat(itsPath);
                if (stat.isFile()) {
                    if (contents[i].startsWith(".")) {
                        fileCatgory = "Configuration";
                    } else {
                        fileCatgory = 'No_Extension'
                    }
                } else {
                    let files = await getFilesFromDir([], itsPath);
                    files.forEach((elem) => {
                        let filePath = elem.replace(`${sourcePath}`, "")
                        fileCatgory = findFileCategory(filePath)
                        categories[fileCatgory].push(filePath)
                    })
                    continue;
                }
            };
            if (fileCatgory == "Disk-Images") fileCatgory = "Disk_Images"
            categories[fileCatgory].push(contents[i])
        }
    }
    let dirToDelete = [];
    let outputText = `${c.yellow}`
    for (const key in categories) {
        if (categories[key].length > 0) {
            let folderCategory = key
            let folderPath = path.join(sourcePath, folderCategory)
            if (folderCategory == "Disk_Images") folderPath = path.join(sourcePath, "Disk-Images")
            let doesFolderExists = await doesPathExists(folderPath)
            if (!doesFolderExists) {
                await fs.mkdir(folderPath, { recursive: true })
            }
            for (let i = 0; i < categories[key].length; i++) {
                let fileSrcPath = path.join(sourcePath, categories[folderCategory][i]);
                let doesFileSrcPathExists = await doesPathExists(fileSrcPath)
                if (!doesFileSrcPathExists) {
                    console.log(`${c.red}Unable to access the files.${c.reset}`)
                    return false;
                }
                let fileDestPath = path.join(folderPath, categories[folderCategory][i])
                let doesFileDestPathExists = await doesPathExists(fileDestPath)
                if (!doesFileDestPathExists) {
                    let firDir = path.dirname(fileDestPath)
                    await fs.mkdir(firDir, { recursive: true })
                    let origPath = path.dirname(fileSrcPath)
                    if (!dirToDelete.includes(origPath)) dirToDelete.push(origPath)
                }
                let status = await moveFile(fileSrcPath, fileDestPath)
                if (!status) {
                    console.log(`${c.red}Error moving files.${c.reset}`)
                    return false
                }
            }
            outputText += `${categories[key].length} items to ${key} directory.\n`
        }
    }
    for (let i = 0; i < dirToDelete.length; i++) {
        let topDir = dirToDelete[i]
        while (path.dirname(topDir) != folderPath) {
            topDir = path.dirname(topDir)
        }
        await rmFolder(topDir)
    }
    outputText += `${c.reset}`
    console.log(outputText)
}

start(folderPath)


//FIXME:{
    // symlink handling
    // duplicate handling
    // dry-run mode & verbose modde  
    // safer empty-folder cleanup
    // proper awaiting/error flow
// }






// import fs from "fs/promises";
// import path from "path";

// const ROOT = folderPath; // your safe boundary

// async function deleteFavourableDir(targetPath) {
//     try {
//         let currentPath = path.resolve(targetPath);

//         // safety: ensure inside ROOT
//         if (!currentPath.startsWith(ROOT)) {
//             throw new Error("Outside allowed root");
//         }

//         while (currentPath.startsWith(ROOT)) {

//             let items = await fs.readdir(currentPath);

//             // if not empty → clean children first
//             if (items.length > 0) {

//                 for (const item of items) {
//                     const itemPath = path.join(currentPath, item);
//                     const stat = await fs.stat(itemPath);

//                     if (stat.isDirectory()) {
//                         // recursively clean subdirectory first
//                         await deleteFavourableDir(itemPath);
//                     } else {
//                         // delete file
//                         await fs.unlink(itemPath);
//                     }
//                 }

//                 // re-check after cleaning
//                 items = await fs.readdir(currentPath);
//             }

//             // if empty now → delete folder
//             if (items.length === 0 && currentPath !== ROOT) {
//                 await fs.rmdir(currentPath);
//             }

//             // move upward
//             if (currentPath === ROOT) break;
//             currentPath = path.dirname(currentPath);
//         }

//     } catch (err) {
//         console.log("Error deleting directory:", err);
//     }
// }