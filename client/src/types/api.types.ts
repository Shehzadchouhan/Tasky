export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  error: string;
  details?: ValidationErrorDetail[];
}
