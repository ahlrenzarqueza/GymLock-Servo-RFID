var awsIot = require('aws-iot-device-sdk');
var rpio = require('rpio');
const { exec } = require("child_process");

const PIN_BUZZER_BEEP1 = 32;
const PIN_BUZZER_BEEP2 = 33;

rpio.open(12, rpio.OUTPUT, rpio.LOW); //Will be connected to Arduino D2
rpio.open(7, rpio.OUTPUT, rpio.LOW); //Will be connected to Arduino
rpio.open(PIN_BUZZER_BEEP1, rpio.OUTPUT, rpio.LOW); //Will be connected to Arduino
rpio.open(PIN_BUZZER_BEEP2, rpio.OUTPUT, rpio.LOW); //Will be connected to Arduino

var device = awsIot.device({
    keyPath: 'certs/842ec95249-private.pem.key',
    certPath: 'certs/842ec95249-certificate.pem.crt',
    caPath: 'certs/root-CA.crt',
    clientId: 'RaspberryPi',
    region: "ap-southeast-1",
    host: 'a35dihqqydbbpb-ats.iot.ap-southeast-1.amazonaws.com',
    baseReconnectTimeMs: 4000,
    keepalive: 300,
    debug: false
});

var sleep = require('system-sleep');

device.subscribe('Door_Access');
device.subscribe('RFID_Response');
device.on('connect', function() {
    console.log('Connected to IoT device');
});

device
    .on('close', function() {
        console.log('close');
    });
device
    .on('reconnect', function() {
        console.log('reconnect');
    });
device
    .on('offline', function() {
        console.log('offline');
    });
device
    .on('error', function(error) {
        console.log('error', error);
    });

var isLockedStatus = false;
var tempId = null, currentId = null;
    
device.on('message', function(topic, payload) {
    if(topic == 'RFID_Response') {
        const result = payload.toString();
        console.log('RFID Response message: ', result);
        if(result == 'Accepted') {
            if(currentId && tempId == currentId) {
                isLockedStatus = false;
                currentId = null;
                console.log('Security status: UNLOCKED. Delaying next read...');
                unlockRpio();
                beep2times();
                setTimeout(pollNFC, 500);
            }
            else if (!isLockedStatus) {
                currentId = tempId;
                isLockedStatus = true;
                console.log('Security status: LOCKED. Delaying next read...');
                lockRpio();
                beep2times();
                setTimeout(pollNFC, 500);
            }
            else {
                beep1time();
                pollNFC();
            }

            // if(isLockedStatus) {
            //     console.log('Security status: LOCKED');
            //     lockRpio();
            //     pollNFC();
            // }
            // else {
            //     console.log('Security status: UNLOCKED. Delaying read for 2 secs...');
            //     unlockRpio();
            //     setTimeout(pollNFC, 2000);
            // }
        }
        else pollNFC();
    }
});

// Scan for RFID 

const pollNFC = () => {
    exec("sudo nfc-poll", (error, stdout, stderr) => {
        if (error || stderr) {
            console.log(`NFC Poll status: No card detected. Retrying...`);
            return setTimeout(pollNFC, 300); 
        }
        else {
            try {
                var carduid = stdout.split("UID (NFCID1):");
                if(carduid.length == 2) {
                    carduid = carduid[1].substr(0, 15);
                    carduid = carduid.replace(/ /g, '');
                    capcarduid = '';
                    for(ind in carduid) {
                        capcarduid += carduid.charAt(ind).toUpperCase();
                    }
                    tempId = capcarduid;
                    console.log(`NFC Card Read: ${capcarduid}`);
                    device.publish('Door_Access', JSON.stringify({
                        data: capcarduid
                    }));
                }
            }
            catch(e) {
                console.log(`NFC Poll status: Unexpected serial response. Retrying...`);
                return setTimeout(pollNFC, 300); 
            }
        }
    });
    
}

const lockRpio = function () {
    rpio.write(12, rpio.HIGH); //Set the GPIO 18 (which is variable command1) to 1 (HIGH)
    rpio.write(7, rpio.HIGH); //Set the GPIO 4 (which is variable command1) to 1 (HIGH)
}

const unlockRpio = function () {
    rpio.write(12, rpio.LOW); //Set the GPIO 18 (which is variable command1) to 0 (LOW)
    rpio.write(7, rpio.LOW); //Set the GPIO 4 (which is variable command1) to 0 (LOW)
}

const beep1time = function () {
    rpio.write(PIN_BUZZER_BEEP1, rpio.HIGH);
    setTimeout(function () {
        rpio.write(PIN_BUZZER_BEEP1, rpio.LOW);
    }, 1000);
}

const beep2times = function () {
    rpio.write(PIN_BUZZER_BEEP2, rpio.HIGH);
    setTimeout(function () {
        rpio.write(PIN_BUZZER_BEEP2, rpio.LOW);
    }, 1000);
}

pollNFC();