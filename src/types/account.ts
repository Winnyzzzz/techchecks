export interface ExtractedAccount {
  id: string;
  device_id: string;
  full_name: string;
  account_number: string;
  referral_code: string;
  sender_name: string;
  status: 'pending' | 'verified' | 'error';
  image_time: string;
  created_at: string;
  updated_at: string;
}

export interface AIExtractionResult {
  fullName: string;
  accountNumber: string;
  referralCode: string;
  senderName: string;
  imageTime?: string;
}
