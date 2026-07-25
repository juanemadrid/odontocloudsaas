import useSWR from 'swr';
import { getPatientsPage } from '../services/patientService';

// Fetcher wrapper that SWR will use
// We use a simple fetcher that calls our service
const fetcher = async ([key, inquilino]) => {
    if (!inquilino) return [];
    const result = await getPatientsPage(inquilino, null, 20); // Fetch first page
    return result.patients;
};

export function usePatientsSWR(inquilino) {
    const { data, error, isLoading, mutate } = useSWR(inquilino ? ['patients-first-page', inquilino] : null, fetcher, {
        revalidateOnFocus: true,
        dedupingInterval: 60000, // 1 minute cache
        keepPreviousData: true,
    });

    return {
        patients: data || [],
        isLoading,
        isError: error,
        mutate // Expose mutate to allow manual revalidation after Create/Update
    };
}
