var awsIot = require('aws-iot-device-sdk');
var rpio = require('rpio');
const { exec } = require("child_process");

const PIN_BUZZER = 32;

rpio.open(12, rpio.OUTPUT, rpio.LOW); //Will be connected to Arduino D2
rpio.open(7, rpio.OUTPUT, rpio.LOW); //Will be connected to Arduino
rpio.open(PIN_BUZZER, rpio.OUTPUT, rpio.LOW); //Will be connected to Buzzer

var device = awsIot.device({
    keyPath: '/home/pi/AWS-RPServoTest/certs/b8ec3871b6-private.pem.key',
    certPath: '/home/pi/AWS-RPServoTest/certs/b8ec3871b6-certificate.pem.crt',
    caPath: '/home/pi/AWS-RPServoTest/certs/CRaspberryPi-RootCAfor-AWS-IoTfromSymantec.crt',
    clientId: 'CRaspberryPi',
    region: "us-west-2",
    host: 'a36tveh4f7ueco.iot.us-west-2.amazonaws.com',
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
                beep2times();
            }
            else if (!isLockedStatus) {
                currentId = tempId;
                isLockedStatus = true;
                beep2times();
            }
            else {
                beep1time();
            }
        }

        if(isLockedStatus) {
            console.log('Security status: LOCKED');
    		lockRpio();
            pollNFC();
        }
        else {
            console.log('Security status: UNLOCKED');
            unlockRpio();
            setTimeout(pollNFC, 3000);
        }
    }
});

// Scan for RFID 

const pollNFC = () => {
    exec("sudo nfc-poll", (error, stdout, stderr) => {
        if (error || stderr) {
            console.log(`NFC Poll status: No card detected. Retrying after 3 secs...`);
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
                console.log(`NFC Poll status: Unexpected serial response. Retrying after 3 secs...`);
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
    rpio.write(PIN_BUZZER, rpio.HIGH);
    setTimeout(function () {
        rpio.write(PIN_BUZZER, rpio.LOW);
    }, 1000);
}

const beep2times = function () {
    rpio.write(PIN_BUZZER, rpio.HIGH);
    setTimeout(function () {
        rpio.write(PIN_BUZZER, rpio.LOW);
        setTimeout(function () {
            rpio.write(PIN_BUZZER, rpio.HIGH);
            setTimeout(function () {
                rpio.write(PIN_BUZZER, rpio.LOW);
            }, 500);
        }, 300)
    }, 500);
}

pollNFC();