#include "DartTool.h"
#include "esp_wifi.h"

void printConnectedClients()
{
    wifi_sta_list_t wifi_sta_list;
    tcpip_adapter_sta_list_t adapter_sta_list;

    if (esp_wifi_ap_get_sta_list(&wifi_sta_list) == ESP_OK) {
        if (tcpip_adapter_get_sta_list(&wifi_sta_list, &adapter_sta_list) == ESP_OK) {
            Serial.printf("Connected Clients: %d\n\n", adapter_sta_list.num);

            for (int i = 0; i < adapter_sta_list.num; i++) {
                tcpip_adapter_sta_info_t station = adapter_sta_list.sta[i];

                Serial.printf("MAC : %02X:%02X:%02X:%02X:%02X:%02X\n",
                              station.mac[0], station.mac[1], station.mac[2],
                              station.mac[3], station.mac[4], station.mac[5]);

                Serial.printf("IP  : %d.%d.%d.%d\n\n",
                              IP2STR(&station.ip));
            }
        }
    }
}
