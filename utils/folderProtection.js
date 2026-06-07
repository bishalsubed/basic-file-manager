import os from "os"
import path from "path"

const linuxProtectedPaths = [
  "/boot",
  "/boot/efi",
  "/etc",
  "/bin",
  "/sbin",
  "/lib",
  "/lib64",
  "/usr",
  "/usr/bin",
  "/usr/sbin",
  "/usr/lib",
  "/usr/lib64",
  "/proc",
  "/sys",
  "/dev",
  "/run",
  "/var",
  "/var/lib",
  "/var/run",
  "/var/cache",
  "/var/log",
  "/lost+found",
  "/snap"
]

const macProtectedPaths = [
  "/System",
  "/System/Applications",
  "/System/Library",
  "/usr",
  "/usr/bin",
  "/usr/sbin",
  "/bin",
  "/sbin",
  "/Library/Apple",
  "/private",
  "/private/etc",
  "/private/var",
  "/dev",
  "/cores",
  "/Volumes/Preboot",
  "/Volumes/Recovery",
  "/Volumes/VM"
];

const macCautionPaths = [
  "/Applications",
  "/Library",
  "/Library/Extensions",
  "/Library/LaunchAgents",
  "/Library/LaunchDaemons"
];

function getSystemDrive() {
  if (process.platform !== "win32") {
    return null;
  }

  if (process.env.SystemDrive) {
    return process.env.SystemDrive;
  }

  const windir = process.env.WINDIR || process.env.SystemRoot;

  if (windir) {
    return path.parse(windir).root.replace(/[\\/]$/, "");
  }

  return "C:";
}

const systemDrive = getSystemDrive()

const windowsProtectedPaths = [
  `${systemDrive}\\Windows`,
  `${systemDrive}\\Program Files`,
  `${systemDrive}\\Program Files (x86)`,
  `${systemDrive}\\ProgramData`,
  `${systemDrive}\\Recovery`,
  `${systemDrive}\\System Volume Information`,
  `${systemDrive}\\$Recycle.Bin`
];


function getProtectedPaths() {
  let platform = os.platform()
  if (platform == "linux") {
    return linuxProtectedPaths;
  } else if (platform == "darwin") {
    return { macProtectedPaths, macCautionPaths };
  } else if (platform == "win32") {
    return windowsProtectedPaths
  }
}

function isProtected(path) {
  let protected_path = getProtectedPaths();
  if (os.platform() == "darwin") {

  } else {
    let isItProtected = false;
    for(let i=0; i<protected_path.length; i++){
      console.log(protected_path[i])
      if(protected_path[i] == path || path.startsWith(protected_path[i])){
        isItProtected = true;
        console.log("Inside the sacred if", isItProtected)
        break;
      }
    }
    console.log("isItProtected", isItProtected)
  }
}

export{
  linuxProtectedPaths
}