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
        return true;
    } catch (error) {
        if (error.code == "EXDEV") {
            try {
                await fs.copyFile(src, dest);
                await fs.unlink(src)
            } catch (error) {
                return false
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
        throw error;
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
        throw error
    }
}

function fixFileCollide(file) {
    let fileArr = file.split(".")

    let filename = fileArr[0];
    let elem = filename[filename.length - 2]
    let newFileName;
    if (Number.isNaN(Number(elem))) {
        newFileName = file.slice(0, filename.length) + "(1)" + file.slice(filename.length)
    } else {
        newFileName = file.slice(0, filename.length - 2) + (Number(elem) + 1) + file.slice(filename.length - 1)
    }
    return newFileName
}


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
let configFile = path.join(__dirname, "config.json");

const configData = await fs.readFile(configFile, "utf-8")
const configuration = JSON.parse(configData);

let flags = process.argv;
let homeDir = os.homedir();
const pathRegex = /^(\/|.*[\/\\].*)$/;

let folderPath;

for (let i = 2; i < flags.length; i++) {
    if (pathRegex.test(flags[i])) {
        folderPath = flags[i]
    } else if (flags[i] == "-r" || flags[i] == "--recursive") {
        configuration["recursive"] = true;
    } else if (flags[i] == "-d" || flags[i] == "--dry-run") {
        configuration["dry-run"] = true;
    } else if (flags[i] == "-v" || flags[i] == "--verbose") {
        configuration["verbose"] = true;
    }
    else {
        console.log(`${c.yellow}Unknown option: ${flags[i]}\n\nUsage:\n\tnode index.js <folder> [options]\nOptions:\n\t-r or --recursive\trecursive\n\t-d or --dry-run\t\tdry-run\n\t-v or --verbose\t\tverbose${c.reset}`)
        process.exit(1);
    }
}

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

    let stats = {
        "processed": 0,
        "moved": 0,
        "skipped": 0
    }

    let contents = await fs.readdir(sourcePath)
    for (let i = 0; i < contents.length; i++) {
        if (!configuration.ignore.includes(contents[i])) {
            let fileStat = await fs.lstat(path.join(sourcePath, contents[i]))
            if (fileStat.isSymbolicLink()) continue
            stats["processed"] = stats["processed"] + 1;
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
                    if (configuration["recursive"]) {
                        let files = await getFilesFromDir([], itsPath);
                        stats["processed"] = stats["processed"] + files.length;
                        files.forEach((elem) => {
                            let filePath = elem.replace(`${sourcePath}`, "")
                            fileCatgory = findFileCategory(filePath)
                            categories[fileCatgory].push(filePath)
                        })
                    }
                    continue;
                }
            };
            if (fileCatgory == "Disk-Images") fileCatgory = "Disk_Images"
            categories[fileCatgory].push(contents[i])
        }
    }
    let dirToDelete = [];
    for (const key in categories) {
        if (categories[key].length > 0) {
            let folderCategory = key
            let folderPath = path.join(sourcePath, folderCategory)
            if (folderCategory == "Disk_Images") folderPath = path.join(sourcePath, "Disk-Images")
            let doesFolderExists = await doesPathExists(folderPath)
            if (!doesFolderExists && !configuration["dry-run"]) {
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
                let doesFileDestDirPathExists = await doesPathExists(path.dirname(fileDestPath))
                if (doesFileDestPathExists) {
                    let fileName = path.basename(fileDestPath)
                    while (true) {
                        let updatedFileName = fixFileCollide(fileName);
                        let newFileDestPath = path.join(folderPath, updatedFileName)
                        let doesUpdatedPathExists = await doesPathExists(newFileDestPath)
                        if (!doesUpdatedPathExists) {
                            fileDestPath = newFileDestPath;
                            break;
                        } else {
                            fileName = updatedFileName
                        }
                    }
                }
                if (!doesFileDestDirPathExists && !configuration["dry-run"]) {
                    let firDir = path.dirname(fileDestPath)
                    await fs.mkdir(firDir, { recursive: true })
                    let origPath = path.dirname(fileSrcPath)
                    if (!dirToDelete.includes(origPath)) dirToDelete.push(origPath)
                }
                if (configuration["dry-run"]) {
                    console.log(`${c.cyan}${fileSrcPath} ------> ${fileDestPath}`)
                    stats.processed += 1
                } else {
                    let status = await moveFile(fileSrcPath, fileDestPath)
                    if (!status) {
                        console.log(`${c.red}Error moving files.${c.reset}`)
                        return false
                    }
                    stats.moved += 1
                }
            }
        }
    }
    if (configuration["verbose"]) {
        console.log(`${c.yellow}Processed: ${stats.processed}\nMoved: ${stats.moved}\nSkipped: ${stats.processed - stats.moved}`)
    }
}

start(folderPath)


//FIXME:{
// symlink handling
// safer empty-folder cleanup
// }



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