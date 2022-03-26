/*
    FortJS
    Written by Ender & Deviationsz (Ender#0001 and Deviationsz#7099)
*/
const memoryJS = require('memoryjs');
const processName = "FortniteClient-Win64-Shipping.exe";
const Logger = require('./logging/log');

// pid
var fortniteProcessId = 0;
var fortniteHandle = undefined;

// vars
var processBase = 0;
var isDebug = undefined;

// offsets (1.8)
const gObjectsOffset = 0x678E010;
const gNamesOffset = 0x6785448;
const gEngineOffset = 0x6877800;
const processEventOffset = 0x1427390;
const fnFreeOffset = 0x1281200;

const maxTotalElements = 2 * 1024 * 1024;
const elementsPerChunk = 16384;
const chunkTableSize = (maxTotalElements + elementsPerChunk - 1) / elementsPerChunk;

var gNameCache = { };
var gObjectsCache = { };
var pfullNameCache = { };
var gObjects;

// classes
// TUObjectArray
class TUObjectArray {
    constructor(process) {
        this.process = process;
    }
    Num() {
        if (this.process != undefined) {
            var GObjectsOffset = (processBase + gObjectsOffset);
            return memoryJS.readMemory(this.process.handle, (GObjectsOffset + 12), "int32");
        } else {
            if (isDebug) {
                Logger.Error("Fortnite process handle is undefined!");
            }
            return null;
        }
    }

    GetByIndex(index) {
        if (gObjectsCache[index] != undefined) {
            return gObjectsCache[index];
        }

        if (this.process != undefined) {
            var GObjectsOffset = (processBase + gObjectsOffset);
            var Objects = memoryJS.readMemory(this.process.handle, (GObjectsOffset), "int64");
            var Object = memoryJS.readMemory(this.process.handle, Objects + (index * 24), "int64");

            gObjectsCache[index] = new UObject(Object);
            return gObjectsCache[index];
        } else {
            if (isDebug) {
                Logger.Error("Fortnite process handle is undefined!");
            }
            return null;
        }
    }

}

class UObject
{
    constructor(address) {
        this.address = address;
    }

    GetNameEntry(index)
    {
        var GNames = memoryJS.readMemory(fortniteHandle.handle, (processBase + gNamesOffset), "int64");
        var chunkIndex = parseInt(index / elementsPerChunk);
        var withinChunkIndex = parseInt(index % elementsPerChunk);
        var chunk = memoryJS.readMemory(fortniteHandle.handle, (GNames + (chunkIndex * 8)), "int64");
        return memoryJS.readMemory(fortniteHandle.handle, (chunk + (withinChunkIndex * 8)), "int64");
    }
    
    GetName()
    {
        
        if (gNameCache[this.address] != undefined) {
            return gNameCache[this.address];
        }    

        var comparisonIndex = memoryJS.readMemory(fortniteHandle.handle, this.address + 0x18, "int32");

        var entry = this.GetNameEntry(comparisonIndex);
        var ansiName = memoryJS.readMemory(fortniteHandle.handle, entry + 16, "string");

        gNameCache[comparisonIndex] = ansiName;

        return ansiName;
    }

    GetFullName()
    {
        if (pfullNameCache[this.address] != undefined) {
            return pfullNameCache[this.address];
        }

        var name = "";

        var Current = this;
        while (true)
        {
            Current = Current.GetOuter();
            if (Current.address == 0)
            {
                break;
            }
            name = Current.GetName() + "." + name;
        }

        var fullName =  this.GetClass().GetName() + " " + name + this.GetName();
        if (fullName.length > 0) {
            pfullNameCache[this.address] = fullName;
        }
        return fullName;
    }

    GetClass()
    {
        return new UObject(memoryJS.readMemory(fortniteHandle.handle, this.address + 0x10, "int64"));
    }
    
    GetOuter()
    {
        return new UObject(memoryJS.readMemory(fortniteHandle.handle, this.address + 0x20, "int64"));
    }

    Member(name)
    {
        var Property = FindObject(name);
        var Offset = memoryJS.readMemory(fortniteHandle.handle, Property.address + 0x44, "int32");

        return new UObject(memoryJS.readMemory(fortniteHandle.handle, this.address + Offset, "int64"));
    }
}

function FindObject(str)
{
    for (var i = 0; i < gObjects.Num(); i++)
    {
        var obj = gObjects.GetByIndex(i);
        if (obj.GetFullName() == (str))
        {
            return obj;
        }
    }
}

// Called after Fortnite is found
function executeProgram() {
    var pfortniteHandle = memoryJS.openProcess(fortniteProcessId);
    var fortniteModule = memoryJS.findModule(processName, fortniteProcessId);
    if (pfortniteHandle != null) {
        // console.log(fortniteHandle);
        memoryJS.getModules(fortniteProcessId, (error, modules) => {
            var fortniteModule = modules.find(module => module.szModule === "FortniteClient-Win64-Shipping.exe");
            if (fortniteModule != null) {
                processBase = pfortniteHandle.modBaseAddr;
                fortniteHandle = pfortniteHandle;
                if (isDebug) {
                    Logger.Log("Process initialized! Base address: 0x" + processBase.toString(16).toUpperCase());
                    Logger.Log("GObjects: 0x" + (processBase + gObjectsOffset).toString(16).toUpperCase());
                    Logger.Log("GNames: 0x" + (processBase + gNamesOffset).toString(16).toUpperCase());
                    Logger.Log("GEngine: 0x" + (processBase + gEngineOffset).toString(16).toUpperCase());
                    Logger.Log("ProcessEvent: 0x" + (processBase + processEventOffset).toString(16).toUpperCase());
                    Logger.Log("FnFree: 0x" + (processBase + fnFreeOffset).toString(16).toUpperCase());
                }
                gObjects = new TUObjectArray(pfortniteHandle);
                if (isDebug)
                {
                    Logger.Log("Objects: " + gObjects.Num());
                    Logger.Log("Initialized");
                }

            } else {
                Logger.Error("Failed to find the Fortnite module. Exiting.");
                process.exit(1);
            }
        });
    } else {
        Logger.Error("Failed to get process handle. Exiting.");
        process.exit(1);
    }
}

// Called when Fortnite is not found
function onFortniteNotFound() {
    Logger.Error("Fortnite not found. Exiting.");
    process.exit(1);
}

module.exports = {
    Initialize(Debug = false) 
    {
        isDebug = Debug;
        memoryJS.getProcesses((error, processes) => {
            for (var i = 0; i < processes.length; i++) {
                var process = processes[i];
                if (process.szExeFile == processName) {
                    fortniteProcessId = process.th32ProcessID;
                    executeProgram();
                    return;
                }
            }
    
            onFortniteNotFound();
        });
    },

    FindObject(str)
    {
        for (var i = 0; i < gObjects.Num(); i++)
        {
            var obj = gObjects.GetByIndex(i);
            if (obj.GetFullName() == (str))
            {
                return obj;
            }
        }
    },

    GetGlobalObjects()
    {
        return gObjects;
    }
}
