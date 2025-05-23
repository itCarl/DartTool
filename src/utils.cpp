#include "DartTool.h"

#ifndef generateUUID_fcn
#define generateUUID_fcn
String generateUUID()
{
    uint8_t uuid[16];
    for (int i = 0; i < 16; i++) {
        uuid[i] = random(256);
    }

    // Set version (4) and variant (10xx)
    uuid[6] = (uuid[6] & 0x0F) | 0x40; // Version 4
    uuid[8] = (uuid[8] & 0x3F) | 0x80; // Variant 10xx

    char uuidStr[37];
    sprintf(uuidStr,
        "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        uuid[0], uuid[1], uuid[2], uuid[3],
        uuid[4], uuid[5],
        uuid[6], uuid[7],
        uuid[8], uuid[9],
        uuid[10], uuid[11], uuid[12], uuid[13], uuid[14], uuid[15]
    );

    return String(uuidStr);
}
#endif
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
