/** Lab DTOs mirrored from the server action so desktop pages can type rpc calls. */
export interface LabResultDto {
  id: string;
  name: string;
  unit: string | null;
  normal_range: string | null;
  value: string | null;
  sort_order: number;
}

export interface LabOrderDto {
  id: string;
  test_name: string;
  token_number: string;
  patient_name: string | null;
  patient_phone: string | null;
  patient_age: string | null;
  patient_gender: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  results: LabResultDto[];
}
