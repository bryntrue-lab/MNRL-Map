import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_BIRTH_DATA_KEY = "mineral_pending_birth_data";

export interface PendingBirthData {
  birthDate?: string;
  birthTime?: string;
  birthLocation?: string;
}

export async function savePendingBirthData(data: PendingBirthData) {
  await AsyncStorage.setItem(PENDING_BIRTH_DATA_KEY, JSON.stringify(data));
}

export async function getPendingBirthData(): Promise<PendingBirthData | null> {
  const value = await AsyncStorage.getItem(PENDING_BIRTH_DATA_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function clearPendingBirthData() {
  await AsyncStorage.removeItem(PENDING_BIRTH_DATA_KEY);
}
