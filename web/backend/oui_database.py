# Offline OUI prefix mapping for common networking devices
OUI_MAP = {
    # Apple
    "000393": "Apple", "000a27": "Apple", "000d93": "Apple", "0010fa": "Apple", "0016cb": "Apple",
    "0017f2": "Apple", "0019e3": "Apple", "001b63": "Apple", "001c42": "Parallels/Apple", "001cbf": "Apple",
    "001d4f": "Apple", "001e52": "Apple", "001f5b": "Apple", "001fc6": "Apple", "0021e9": "Apple",
    "002241": "Apple", "002312": "Apple", "002332": "Apple", "0023ac": "Apple", "002436": "Apple",
    "002500": "Apple", "00254b": "Apple", "002608": "Apple", "0026b0": "Apple", "0026bb": "Apple",
    "0418d6": "Apple", "0426c7": "Apple", "044b80": "Apple", "0452f3": "Apple", "04f13e": "Apple",
    "0c5101": "Apple", "101c0c": "Apple", "1040f3": "Apple", "109add": "Apple", "10ddb1": "Apple",
    "28cfda": "Apple", "34159e": "Apple", "3c0754": "Apple", "3cd0f8": "Apple", "403004": "Apple",
    "40a6d9": "Apple", "44d884": "Apple", "4c7c5f": "Apple", "542a1b": "Apple", "5c5188": "Apple",
    "600308": "Apple", "60334b": "Apple", "60facd": "Apple", "64200c": "Apple", "647033": "Apple",
    "64b9e8": "Apple", "6c4008": "Apple", "6c709f": "Apple", "701124": "Apple", "705681": "Apple",
    "70700d": "Apple", "70a2b9": "Apple", "70cd60": "Apple", "748d08": "Apple", "784f43": "Apple",
    "787b8a": "Apple", "78886d": "Apple", "78ca39": "Apple", "7c6d62": "Apple", "7cbbc1": "Apple",
    "7cd1c3": "Apple", "804971": "Apple", "8084a3": "Apple", "80b220": "Apple", "80d686": "Apple",
    "842999": "Apple", "843835": "Apple", "84788b": "Apple", "848508": "Apple", "84c9b2": "Apple",
    "84fcfe": "Apple", "8863fc": "Apple", "88665a": "Apple", "88c241": "Apple", "88cb87": "Apple",
    "88e9fe": "Apple", "9027e8": "Apple", "903c7a": "Apple", "907240": "Apple", "90840d": "Apple",
    "90b21f": "Apple", "94103e": "Apple", "947b5f": "Apple", "949426": "Apple", "94e96d": "Apple",
    "9801a7": "Apple", "9810e8": "Apple", "985a1a": "Apple", "989e63": "Apple", "98d6bb": "Apple",
    "98e7f4": "Apple", "9c04eb": "Apple", "9c207b": "Apple", "9c35eb": "Apple", "9c4f5e": "Apple",
    "a01828": "Apple", "a03b8b": "Apple", "a43135": "Apple", "a45e60": "Apple", "a47737": "Apple",
    "a4b197": "Apple", "a4c361": "Apple", "a4d18c": "Apple", "a82066": "Apple", "a85b78": "Apple",
    "a860b6": "Apple", "a8667f": "Apple", "a88808": "Apple", "a88e24": "Apple", "a8bbcf": "Apple",
    "a8fa48": "Apple", "ac162d": "Apple", "ac220b": "Apple", "ac3c0b": "Apple", "ac7f3e": "Apple",
    "ac87a3": "Apple", "acc1ee": "Apple", "b019c6": "Apple", "b0359f": "Apple", "b065bd": "Apple",
    "b0702d": "Apple", "b0c090": "Apple", "b0d59d": "Apple", "b418d1": "Apple", "b48b19": "Apple",
    "b4f61c": "Apple", "b8098a": "Apple", "b88d12": "Apple", "b8c75d": "Apple", "b8e856": "Apple",
    "b8f6b1": "Apple", "bc3b8b": "Apple", "bc4c8a": "Apple", "bc52b7": "Apple", "bc6784": "Apple",
    "bc9fef": "Apple", "bcc67a": "Apple", "c01885": "Apple", "c03896": "Apple", "c06394": "Apple",
    "c09f42": "Apple", "c0a53e": "Apple", "c0b9e2": "Apple", "c0d012": "Apple", "c42c03": "Apple",
    "c43c6e": "Apple", "c48508": "Apple", "c4aa59": "Apple", "c4b301": "Apple", "c4d987": "Apple",
    "c81e77": "Apple", "c82a14": "Apple", "c8334b": "Apple", "c869cd": "Apple", "c88550": "Apple",
    "c8bc23": "Apple", "c8d0e7": "Apple", "c8e0eb": "Apple", "c8f73a": "Apple", "cc08e0": "Apple",
    "cc20e8": "Apple", "cc25ef": "Apple", "cc29f5": "Apple", "cc4463": "Apple", "cc7e5f": "Apple",
    "d0034b": "Apple", "d023db": "Apple", "d02598": "Apple", "d03742": "Apple", "d04f7e": "Apple",
    "d0a5a6": "Apple", "d0c5f3": "Apple", "d0d2b9": "Apple", "d0e140": "Apple", "d428b2": "Apple",
    "d43b04": "Apple", "d4909c": "Apple", "d4dc07": "Apple", "d4f46f": "Apple", "d8004d": "Apple",
    "d81c79": "Apple", "d83062": "Apple", "d88f76": "Apple", "d89695": "Apple", "d8a25e": "Apple",
    "d8bb2c": "Apple", "d8c13b": "Apple", "d8cf9c": "Apple", "d8d13b": "Apple", "e03f49": "Apple",
    "e06678": "Apple", "e0accb": "Apple", "e0b52d": "Apple", "e0c937": "Apple", "e0d7ba": "Apple",
    "e0db55": "Apple", "e0f5c6": "Apple", "e0f847": "Apple", "e425e9": "Apple", "e48b7f": "Apple",
    "e4907e": "Apple", "e4a471": "Apple", "e4b205": "Apple", "e4c15a": "Apple", "e4e4ab": "Apple",
    "e8040b": "Apple", "e80688": "Apple", "e8802e": "Apple", "e8b2ac": "Apple", "f01898": "Apple",
    "f02475": "Apple", "f0761c": "Apple", "f07960": "Apple", "f0989d": "Apple", "f0a225": "Apple",
    "f0c1f1": "Apple", "f0dbf6": "Apple", "f0dca2": "Apple", "f0f61a": "Apple", "f40f24": "Apple",
    "f41b5f": "Apple", "f431c3": "Apple", "f437b7": "Apple", "f45c89": "Apple", "f490f8": "Apple",
    "f4f15a": "Apple", "f4f951": "Apple", "f80377": "Apple", "f81edf": "Apple", "f82793": "Apple",
    "f83880": "Apple", "f86214": "Apple", "f8a45f": "Apple", "f8b156": "Apple", "f8cab7": "Apple",
    "f8e903": "Apple", "fc1d43": "Apple", "fc2575": "Apple", "fc2a54": "Apple", "fc2d5e": "Apple",
    "fc7516": "Apple", "fce998": "Apple", "fcf8ae": "Apple", "e45f01": "Apple",

    # Samsung
    "0000f0": "Samsung", "000278": "Samsung", "0007ab": "Samsung", "000df1": "Samsung", "001247": "Samsung",
    "0012fb": "Samsung", "0015b9": "Samsung", "00166c": "Samsung", "0017c5": "Samsung", "0018af": "Samsung",
    "3052cb": "Samsung", "38aa3c": "Samsung", "4040a7": "Samsung", "508569": "Samsung", "54fa3e": "Samsung",
    "700514": "Samsung", "78287f": "Samsung", "843838": "Samsung", "90b686": "Samsung", "9ca9e4": "Samsung",
    "a87b3f": "Samsung", "c43ab5": "Samsung", "cc07ab": "Samsung", "e4e0a6": "Samsung", "f8042e": "Samsung",
    
    # Intel
    "000347": "Intel", "000423": "Intel", "0008ca": "Intel", "001302": "Intel", "001500": "Intel",
    "0016ea": "Intel", "0018de": "Intel", "001b21": "Intel", "001c25": "Intel", "001d0f": "Intel",
    "001e64": "Intel", "001f3b": "Intel", "0021ccc": "Intel", "002715": "Intel", "0090f5": "Intel",
    "081196": "Intel", "3413e8": "Intel", "40ed00": "Intel", "a434d9": "Intel", "b88584": "Intel",
    "e4a7a1": "Intel", "fc3497": "Intel",

    # Cisco / Linksys
    "00000c": "Cisco", "000142": "Cisco", "000164": "Cisco", "0001c7": "Cisco", "000216": "Cisco",
    "00024b": "Cisco", "0002b9": "Cisco", "0002fc": "Cisco", "000331": "Cisco", "00036b": "Cisco",
    "0003e3": "Cisco", "000427": "Cisco", "00044d": "Cisco", "00049a": "Cisco", "0004c0": "Cisco",
    "0004dd": "Cisco", "000531": "Cisco", "00055e": "Cisco", "000574": "Cisco", "00059a": "Cisco",
    "a491b1": "Cisco", "00259c": "Cisco-Linksys", "001839": "Cisco-Linksys", "00236a": "Cisco-Linksys",

    # TP-Link
    "000aeb": "TP-Link", "001478": "TP-Link", "001d0f": "TP-Link", "002127": "TP-Link", "18a6f7": "TP-Link",
    "30b5c2": "TP-Link", "3c46d8": "TP-Link", "40169f": "TP-Link", "50c7bf": "TP-Link", "704f57": "TP-Link",
    "74ea3a": "TP-Link", "8416f9": "TP-Link", "8c210a": "TP-Link", "98de1c": "TP-Link", "a42bb0": "TP-Link",
    "b0487a": "TP-Link", "c0c9e3": "TP-Link", "c46e1f": "TP-Link", "d807b6": "TP-Link", "e894f6": "TP-Link",
    "ec086b": "TP-Link", "f81a67": "TP-Link", "c8d719": "TP-Link",

    # Huawei
    "001882": "Huawei", "00259e": "Huawei", "00464b": "Huawei", "00e0fc": "Huawei", "0819a6": "Huawei",
    "0c37dc": "Huawei", "101b54": "Huawei", "104780": "Huawei", "1c1d67": "Huawei", "200bc7": "Huawei",
    "202bc1": "Huawei", "240995": "Huawei", "24df6a": "Huawei", "283152": "Huawei", "283c50": "Huawei",
    "285f56": "Huawei", "286e30": "Huawei", "342e1b": "Huawei", "380195": "Huawei", "3ccd36": "Huawei",
    "404d7f": "Huawei", "485702": "Huawei", "4c1fcc": "Huawei", "548998": "Huawei", "5c4dd0": "Huawei",

    # Xiaomi
    "009e8e": "Xiaomi", "04b126": "Xiaomi", "185936": "Xiaomi", "286c07": "Xiaomi", "3480b3": "Xiaomi",
    "3c12aa": "Xiaomi", "50642b": "Xiaomi", "5c6beb": "Xiaomi", "64cc2e": "Xiaomi", "7c1d3f": "Xiaomi",
    "8cbebe": "Xiaomi", "981094": "Xiaomi", "9c99a0": "Xiaomi", "a45c27": "Xiaomi", "c88d83": "Xiaomi",
    "e0151b": "Xiaomi", "fc643a": "Xiaomi",

    # Raspberry Pi
    "b827eb": "Raspberry Pi Foundation", "dca632": "Raspberry Pi Foundation", "e45f01": "Raspberry Pi Foundation",

    # VMware
    "000569": "VMware", "000c29": "VMware", "005056": "VMware",

    # Realtek
    "00e04c": "Realtek Semiconductor", "525400": "Realtek/QEMU", "74da38": "Realtek",

    # Ubiquiti Networks
    "00156d": "Ubiquiti Networks", "0418d6": "Ubiquiti Networks", "24a43c": "Ubiquiti Networks",
    "44d9e7": "Ubiquiti Networks", "68ff7b": "Ubiquiti Networks", "788a13": "Ubiquiti Networks",
    "802aa8": "Ubiquiti Networks", "b4fbf3": "Ubiquiti Networks", "d021f9": "Ubiquiti Networks",
    "e8ed90": "Ubiquiti Networks", "fcecda": "Ubiquiti Networks",

    # HP
    "0001e6": "HP", "000802": "HP", "000f20": "HP", "001083": "HP", "00110a": "HP",
    "0013c8": "HP", "001438": "HP", "001560": "HP", "001635": "HP", "001708": "HP",
    "0018fe": "HP", "0019bb": "HP", "001a4b": "HP", "001b78": "HP", "001c2e": "HP",

    # Dell
    "00065b": "Dell", "000874": "Dell", "000bdb": "Dell", "000d56": "Dell", "000f1f": "Dell",
    "001143": "Dell", "001372": "Dell", "001422": "Dell", "0015c5": "Dell", "0016f0": "Dell",
    "00188b": "Dell", "0019b9": "Dell", "001a92": "Dell", "001c23": "Dell", "001d09": "Dell",

    # Microsoft
    "0003ff": "Microsoft", "00125a": "Microsoft", "001dd8": "Microsoft", "00155d": "Microsoft Hyper-V",
    
    # Google
    "001a11": "Google", "3c5ab4": "Google", "da1a89": "Google",

    # Sony
    "00014a": "Sony", "00041f": "Sony", "000a95": "Sony", "001315": "Sony", "0015c1": "Sony",
    "705ab6": "Sony",
}

def resolve_vendor(mac_address):
    clean_mac = mac_address.lower().replace(":", "").replace("-", "")[:6]
    return OUI_MAP.get(clean_mac, "Unknown Vendor")
