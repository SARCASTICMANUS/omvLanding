import React from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";

const AdminRouteForm = ({ routeName, setRouteName, onSave }) => {
  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Route Name"
        value={routeName}
        onChangeText={setRouteName}
        style={styles.input}
      />

      <Button title="Save Route" onPress={onSave} />
    </View>
  );
};

export default AdminRouteForm;

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
});