export class ApiError extends Error {}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("The schedule couldn't load. Check that the server is running.");
  }

  const text = await response.text();
  let data: { message?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as { message?: string };
    } catch {
      throw new ApiError("The server sent a response I couldn't read.");
    }
  }
  if (!response.ok) {
    throw new ApiError(data.message || "That didn't work.");
  }
  return data as T;
}
