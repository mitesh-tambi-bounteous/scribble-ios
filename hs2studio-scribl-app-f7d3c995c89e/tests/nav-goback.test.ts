import { goBackImpl } from "@/src/lib/nav";

describe("goBack function", () => {
  it("calls router.back() when canGoBack() returns true", () => {
    const mockBack = jest.fn();
    const mockCanGoBack = jest.fn().mockReturnValue(true);
    const mockReplace = jest.fn();

    const mockRouter = {
      back: mockBack,
      canGoBack: mockCanGoBack,
      replace: mockReplace,
    };

    goBackImpl(mockRouter, "/home");

    expect(mockCanGoBack).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("calls router.replace(fallback) when canGoBack() returns false", () => {
    const mockBack = jest.fn();
    const mockCanGoBack = jest.fn().mockReturnValue(false);
    const mockReplace = jest.fn();

    const mockRouter = {
      back: mockBack,
      canGoBack: mockCanGoBack,
      replace: mockReplace,
    };

    const fallback = "/home";
    goBackImpl(mockRouter, fallback);

    expect(mockCanGoBack).toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(fallback);
  });

  it("passes the fallback to replace() when stack is empty (web refresh)", () => {
    const mockBack = jest.fn();
    const mockCanGoBack = jest.fn().mockReturnValue(false);
    const mockReplace = jest.fn();

    const mockRouter = {
      back: mockBack,
      canGoBack: mockCanGoBack,
      replace: mockReplace,
    };

    const fallback = "/draw";
    goBackImpl(mockRouter, fallback);

    expect(mockReplace).toHaveBeenCalledWith(fallback);
  });

  it("does not call replace() when back() succeeds", () => {
    const mockBack = jest.fn();
    const mockCanGoBack = jest.fn().mockReturnValue(true);
    const mockReplace = jest.fn();

    const mockRouter = {
      back: mockBack,
      canGoBack: mockCanGoBack,
      replace: mockReplace,
    };

    goBackImpl(mockRouter, "/");

    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
