#pragma once
#include <Arduino.h>

inline String generateUuid() {
    char buf[37];
    snprintf(buf, sizeof(buf),
        "%04x%04x-%04x-%04x-%04x-%04x%04x%04x",
        random(0, 0xffff), random(0, 0xffff),
        random(0, 0xffff),
        (random(0, 0x0fff) | 0x4000), // version 4
        (random(0, 0x3fff) | 0x8000), // variant 1
        random(0, 0xffff), random(0, 0xffff), random(0, 0xffff)
    );
    return String(buf);
}

// String getMACFromIP(IPAddress ip)
// {
//     struct station_info *stat_info = wifi_softap_get_station_info();
//     while (stat_info != NULL) {
//         DEBUG_PRINT("StatInfo:");
//         DEBUG_PRINTLN(IPAddress(stat_info->ip.addr));
//         DEBUG_PRINT("ip:");
//         DEBUG_PRINTLN(ip);
//         if (ip == IPAddress(stat_info->ip.addr)) {
//             uint8_t *mac = stat_info->bssid;
//             char macStr[18];
//             sprintf(macStr, "%02X:%02X:%02X:%02X:%02X:%02X",
//                     mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
//             return String(macStr);
//         }
//         stat_info = STAILQ_NEXT(stat_info, next);
//     }
//     wifi_softap_free_station_info();
//     return "";
// }


// void temp()
// {
//     DEBUG_PRINTLN("aaa");

//     String clientMAC = getMACFromIP(request->client()->remoteIP());
//     DEBUG_PRINTLN("Client connected: "+ clientMAC);

//     if (gmMAC == "") {
//         gmMAC = clientMAC;
//         DEBUG_PRINTLN("Game Master set to: " + gmMAC);
//     }

//     // return && clientMAC != gmMAC;

// }
