import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { STORAGE_KEYS } from "../../constants";

const STORAGE_DRAFT_KEY = "@vayy_onboarding_draft";

export const loadDraftFromStorage = createAsyncThunk(
  "onboarding/loadDraftFromStorage",
  async () => {
    const draftStr = await AsyncStorage.getItem(STORAGE_DRAFT_KEY);
    return draftStr ? JSON.parse(draftStr) : null;
  }
);

export const saveDraftToStorage = createAsyncThunk(
  "onboarding/saveDraftToStorage",
  async (draft) => {
    await AsyncStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draft));
  }
);

export const clearDraftFromStorage = createAsyncThunk(
  "onboarding/clearDraftFromStorage",
  async () => {
    await AsyncStorage.removeItem(STORAGE_DRAFT_KEY);
  }
);

const initialState = {
  step: 1,
  fields: {},
  draftSaved: false,
  lastCompletedStep: null,
};

const onboardingSlice = createSlice({
  name: "onboarding",
  initialState,
  reducers: {
    setStep: (state, action) => {
      state.step = action.payload.step;
    },
    setField: (state, action) => {
      const { field, value } = action.payload;
      state.fields = { ...state.fields, [field]: value };
    },
    setLastCompletedStep: (state, action) => {
      state.lastCompletedStep = action.payload.step;
    },
    clearFields: (state) => {
      state.fields = {};
    },
    saveDraft: (state) => {
      state.draftSaved = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDraftFromStorage.fulfilled, (state, action) => {
        if (action.payload) {
          state.step = action.payload.step;
          state.fields = action.payload.fields;
          state.lastCompletedStep = action.payload.lastCompletedStep;
          state.draftSaved = action.payload.draftSaved;
        }
      })
      .addCase(saveDraftToStorage.fulfilled, (state) => {
        state.draftSaved = true;
      })
      .addCase(clearDraftFromStorage.fulfilled, (state) => {
        state.step = 1;
        state.fields = {};
        state.lastCompletedStep = null;
        state.draftSaved = false;
      });
  },
});

export const { setStep, setField, setLastCompletedStep, clearFields, saveDraft } = onboardingSlice.actions;
export default onboardingSlice.reducer;