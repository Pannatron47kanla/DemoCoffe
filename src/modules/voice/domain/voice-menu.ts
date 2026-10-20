// มุมมองเมนูของ voice (ไม่ import จาก menu context)
export interface VoiceMenuChoice { id: string; name: string; priceDeltaSatang: number }
export interface VoiceMenuGroup { id: string; name: string; required: boolean; choices: VoiceMenuChoice[] }
export interface VoiceMenuItem { id: string; name: string; basePriceSatang: number; available: boolean; optionGroups: VoiceMenuGroup[] }
